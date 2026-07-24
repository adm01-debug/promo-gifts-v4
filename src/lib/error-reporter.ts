/**
 * Centralized error reporting service.
 * Captures unhandled errors and sends them to frontend_telemetry for monitoring.
 *
 * HISTÓRICO:
 * - Antes (até 2026-06-15): escrevia em admin_audit_log (action='client_error')
 *   → contaminava a tabela de auditoria com ruído de dev (42.946 linhas / 60 MB)
 * - Agora: escreve em frontend_telemetry, que é o lugar semântico correto
 *   → RLS adequada, retenção 30 dias, sem poluir o audit trail
 */
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/sentry';
import { isColdStartSignal } from '@/lib/external-db/bridge-status-events';

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

const ERROR_QUEUE: ErrorReport[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 5000;
const MAX_QUEUE = 20;

/**
 * Padrões de erros TRANSITÓRIOS de runtime das edge functions:
 *  - SUPABASE_EDGE_RUNTIME_ERROR
 *  - service is temporarily unavailable (503)
 *  - boot_error / function failed to start
 *  - 502 / 504 (bad gateway / gateway timeout)
 *
 * Phase 4B (2026-06-01): removed bridge recovery listener (COLD_START_BUFFER).
 * Cold-start deferral was only useful when the bridge could "recover" — since the
 * bridge is permanently OFF, the deferred path never fired. Transient errors from
 * other edge functions (crm-db-bridge, etc.) are still classified correctly via
 * isColdStartSignal and TRANSIENT_RE, then sent immediately.
 */
const TRANSIENT_EDGE_RUNTIME_PATTERNS = [
  'supabase_edge_runtime_error',
  'service is temporarily unavailable',
  'boot_error',
  'function failed to start',
  '\\b503\\b',
  '\\b502\\b',
  '\\b504\\b',
  'bad gateway',
  'gateway timeout',
];

const TRANSIENT_RE = new RegExp(TRANSIENT_EDGE_RUNTIME_PATTERNS.join('|'), 'i');

export function isTransientEdgeRuntimeError(input: Error | string | null | undefined): boolean {
  if (!input) return false;
  const haystack = typeof input === 'string' ? input : `${input.message} ${input.stack ?? ''}`;
  return isColdStartSignal(haystack) || TRANSIENT_RE.test(haystack);
}

async function flushErrors() {
  if (ERROR_QUEUE.length === 0) return;

  const batch = ERROR_QUEUE.splice(0, MAX_QUEUE);

  try {
    const supabase = await getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null; // null quando não autenticado (antes era UUID zero)

    for (const err of batch) {
      err.userId = userId ?? undefined;
    }

    // Mapear para o schema de frontend_telemetry
    // Constraints RLS: event_type 1-64, name 1-256, url ≤2048,
    //                  user_agent ≤1024, session_id ≤128, metadata ≤8192
    const rows = batch.map((err) => {
      const metadataPayload = {
        stack: err.stack?.slice(0, 2000),
        timestamp: err.timestamp,
        componentStack: err.componentStack?.slice(0, 500),
        ...err.metadata,
      };

      return {
        event_type: 'error',
        name: err.message.slice(0, 256) || 'Unknown error',
        url: err.url.slice(0, 2048),
        user_agent: err.userAgent.slice(0, 1024),
        user_id: err.userId ?? null,
        metadata: metadataPayload,
      };
    });

    // CORREÇÃO (2026-06-15): frontend_telemetry é o destino correto.
    // admin_audit_log é exclusivo para eventos de auditoria administrativa.
    const { error } = await supabase.from('frontend_telemetry').insert(rows);
    if (error) logger.warn('[ErrorReporter] Failed to flush:', error.message);
  } catch (e) {
    logger.warn('[ErrorReporter] Flush failed:', e);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushErrors();
  }, FLUSH_INTERVAL);
}

function enqueueReport(report: ErrorReport) {
  ERROR_QUEUE.push(report);
  if (ERROR_QUEUE.length >= MAX_QUEUE) {
    flushErrors();
  } else {
    scheduleFlush();
  }
}

export function reportError(error: Error, metadata?: Record<string, unknown>) {
  const originalType = typeof metadata?.type === 'string' ? metadata.type : undefined;
  const transient = isTransientEdgeRuntimeError(error);

  const category = transient
    ? 'transient_edge_runtime'
    : originalType === 'react_error_boundary'
      ? 'blank_screen'
      : 'app_error';

  const enrichedMetadata: Record<string, unknown> = {
    ...metadata,
    category,
    ...(transient ? { type: 'transient_edge_runtime', original_type: originalType } : {}),
  };

  const report: ErrorReport = {
    message: error.message,
    stack: error.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    metadata: enrichedMetadata,
  };

  captureException(error, enrichedMetadata);
  enqueueReport(report);
}

/**
 * Install global error listeners for unhandled errors and promise rejections.
 */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    reportError(event.error || new Error(event.message), {
      type: 'unhandled_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    reportError(error, { type: 'unhandled_promise_rejection' });
  });
}

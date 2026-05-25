/**
 * Centralized error reporting service.
 * Captures unhandled errors and sends them to the database for monitoring.
 */
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/sentry';
import { onBridgeStatus, isColdStartSignal } from '@/lib/external-db/bridge-status-events';

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
 * Buffer de erros suspeitos de "cold-start" (503 / boot_error / function failed to start).
 * Adia o envio por COLD_START_DEFER_MS para que um evento `recovered` da bridge
 * possa descartá-los — evitando false positives quando a 2ª tentativa carrega com sucesso.
 */
type DeferredColdStart = {
  report: ErrorReport;
  timer: ReturnType<typeof setTimeout>;
};
const COLD_START_DEFER_MS = 8000;
const COLD_START_BUFFER: DeferredColdStart[] = [];
let bridgeListenerInstalled = false;

function installBridgeListenerOnce() {
  if (bridgeListenerInstalled) return;
  bridgeListenerInstalled = true;
  onBridgeStatus((e) => {
    if (e.type !== 'recovered') return;
    // Bridge recuperou: descarta todos os 503/boot ainda pendentes na janela.
    while (COLD_START_BUFFER.length > 0) {
      const pending = COLD_START_BUFFER.shift()!;
      clearTimeout(pending.timer);
      logger.debug('[ErrorReporter] Discarded cold-start false positive after bridge recovery');
    }
  });
}

/**
 * Padrões de erros TRANSITÓRIOS de runtime das edge functions:
 *  - SUPABASE_EDGE_RUNTIME_ERROR
 *  - service is temporarily unavailable (503)
 *  - boot_error / function failed to start
 *  - 502 / 504 (bad gateway / gateway timeout — também são transientes)
 *
 * Esses erros NÃO devem ser registrados como "blank screen" / crash de UI,
 * pois quase sempre são curados pela 2ª tentativa do invoke (cold-start).
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

export function isTransientEdgeRuntimeError(input: string | Error | null | undefined): boolean {
  if (!input) return false;
  const haystack = typeof input === 'string' ? input : `${input.message} ${input.stack ?? ''}`;
  // isColdStartSignal cobre o vocabulário oficial da bridge; o regex local
  // amplia para variações que podem chegar do Error Boundary sem passar pela bridge.
  return isColdStartSignal(haystack) || TRANSIENT_RE.test(haystack);
}

function _isColdStartReport(report: ErrorReport): boolean {
  const haystack = `${report.message} ${report.stack ?? ''}`;
  return isTransientEdgeRuntimeError(haystack);
}

async function flushErrors() {
  if (ERROR_QUEUE.length === 0) return;

  const batch = ERROR_QUEUE.splice(0, MAX_QUEUE);

  try {
    const supabase = await getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    for (const err of batch) {
      err.userId = userId;
    }

    // Log to admin_audit_log for observability
    const rows = batch.map((err) => ({
      action: 'client_error',
      resource_type: 'error',
      resource_id: null,
      user_id: err.userId || '00000000-0000-0000-0000-000000000000',
      details: {
        message: err.message,
        stack: err.stack?.slice(0, 2000),
        url: err.url,
        timestamp: err.timestamp,
        userAgent: err.userAgent.slice(0, 200),
        ...err.metadata,
      },
      ip_address: null,
      user_agent: err.userAgent.slice(0, 200),
    }));

    const { error } = await supabase.from('admin_audit_log').insert(rows);
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

  // Categoria explícita ajuda dashboards a separar "tela branca real"
  // de incidentes transitórios de runtime/cold-start de edge functions.
  const category = transient
    ? 'transient_edge_runtime'
    : originalType === 'react_error_boundary'
      ? 'blank_screen'
      : 'app_error';

  const enrichedMetadata: Record<string, unknown> = {
    ...metadata,
    category,
    // Quando o erro é transitório, sobrescreve o `type` para que filtros
    // legados (que agrupam por type=react_error_boundary/unhandled_*)
    // não contabilizem como blank screen.
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

  // Cold-start / runtime transitório (503, SUPABASE_EDGE_RUNTIME_ERROR, boot_error,
  // "service is temporarily unavailable", 502/504) costuma ser recuperado pela
  // 2ª tentativa. Adia o envio e descarta se a bridge emitir `recovered` dentro
  // da janela. Caller pode forçar registro imediato via metadata.skipColdStartDefer = true.
  const skipDefer = metadata?.skipColdStartDefer === true;
  if (!skipDefer && transient) {
    installBridgeListenerOnce();
    const entry: DeferredColdStart = {
      report,
      timer: setTimeout(() => {
        const idx = COLD_START_BUFFER.indexOf(entry);
        if (idx >= 0) COLD_START_BUFFER.splice(idx, 1);
        // Não recuperou na janela: registra mantendo a categoria transitória
        // (não escala para "blank screen") e marca como não recuperado.
        captureException(error, { ...enrichedMetadata, cold_start_unrecovered: true });
        enqueueReport({
          ...report,
          metadata: { ...(report.metadata ?? {}), cold_start_unrecovered: true },
        });
      }, COLD_START_DEFER_MS),
    };
    COLD_START_BUFFER.push(entry);
    return;
  }

  // Forward to Sentry (no-op if DSN not configured)
  captureException(error, enrichedMetadata);
  enqueueReport(report);
}

/**
 * Install global error listeners for unhandled errors and promise rejections.
 */
export function installGlobalErrorHandlers() {
  installBridgeListenerOnce();
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

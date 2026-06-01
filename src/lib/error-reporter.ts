/**
 * Centralized error reporting service.
 * Captures unhandled errors and sends them to the database for monitoring.
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

export function isTransientEdgeRuntimeError(input: string | Error | null | undefined): boolean {
  if (!input) return false;
  const haystack = typeof input === 'string' ? input : `${input.message} ${input.stack ?? ''}`;
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

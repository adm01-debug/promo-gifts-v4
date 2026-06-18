/**
 * Utilitários de invocação do external-db-bridge com retry e error handling.
 * Extraído de useExternalDatabase.ts para modularização.
 *
 * CONTAINMENT (2026-05-24): integra com kill-switch client. Quando o switch
 * `edge_external_db_bridge` está OFF em public.system_kill_switches, o front
 * SHORT-CIRCUIT (não chama a edge function). Reduz custo, logs e o loop do colapso.
 * Ver: src/lib/external-db/kill-switch-client.ts e
 *      docs/PATCH_external_db_bridge_kill_switch.md.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { emitBridgeStatus, isColdStartSignal } from './bridge-status-events';
import { ensureCloudReady, CloudNotReadyError, getCachedCloudStatus } from '@/lib/cloud-status';
import {
  recordBridgeCall,
  estimatePayloadBytes,
  type BridgeOperation,
} from '@/lib/telemetry/bridgeCallMetrics';
import { newRequestId, REQUEST_ID_HEADER } from '@/lib/telemetry/requestId';
import {
  getKillSwitchState,
  invalidateKillSwitchCache,
  KillSwitchActiveError,
} from './kill-switch-client';
import { recordKillSwitchHit } from './kill-switch-telemetry';

const KILL_SWITCH_NAME = 'edge_external_db_bridge';

const KNOWN_BRIDGE_OPERATIONS = new Set<BridgeOperation>([
  'select',
  'insert',
  'update',
  'delete',
  'upsert',
  'batch',
  'rpc',
  'invoke',
  'handshake',
  'health',
]);

function deriveExternalOp(body: Record<string, unknown>): { op: BridgeOperation; target?: string } {
  const operation = typeof body.operation === 'string' ? body.operation : undefined;
  const table = typeof body.table === 'string' ? body.table : undefined;
  const rpc = typeof body.rpc === 'string' ? body.rpc : undefined;
  if (rpc) return { op: `rpc:${rpc}`, target: rpc };
  if (operation && KNOWN_BRIDGE_OPERATIONS.has(operation as BridgeOperation)) {
    return { op: operation as BridgeOperation, target: table };
  }
  return { op: 'invoke', target: table ?? operation };
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 800;
const RETRYABLE_PATTERNS = [
  'statement timeout',
  '57014',
  '502',
  '503',
  '504',
  'bad gateway',
  'FunctionsHttpError',
  'network',
  'fetch',
  'ECONNRESET',
  'socket hang up',
  'AbortError',
  'Failed to fetch',
  // Cold-start / runtime boot do isolate da edge function (plataforma)
  'supabase_edge_runtime_error',
  'service is temporarily unavailable',
  'boot_error',
  'function failed to start',
];

// Erros determinísticos do Postgres/PostgREST: retry NUNCA muda o resultado.
const NON_RETRYABLE_PATTERNS = [
  'does not exist',
  'invalid input syntax',
  'pgrst',
  'permission denied',
  'duplicate key',
  'violates ',
  'syntax error',
  'malformed',
  'jwt',
  'unauthorized',
  // Kill-switch ativo: 410 Gone é DEFINITIVO, não retry.
  'gone',
  'kill-switch',
];

const NON_RETRYABLE_HTTP_RE = /(?:returned\s+|status[: ]\s*|http[:/ ])(400|401|403|410)\b/i;

function matches(msg: string, patterns: string[]): boolean {
  const lower = msg.toLowerCase();
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

function isNonRetryableError(msg: string): boolean {
  if (/\b503\b/.test(msg) || /service is temporarily unavailable/i.test(msg)) return false;
  if (matches(msg, NON_RETRYABLE_PATTERNS)) return true;
  return NON_RETRYABLE_HTTP_RE.test(msg);
}

function isRetryableError(msg: string): boolean {
  if (isNonRetryableError(msg)) return false;
  return matches(msg, RETRYABLE_PATTERNS);
}

function isKillSwitch410(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const maybeContext = error as Error & { context?: Response };
  if (maybeContext.context instanceof Response && maybeContext.context.status === 410) {
    return true;
  }
  return /\b410\b/.test(error.message) || /\bgone\b/i.test(error.message);
}

export async function extractFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof Error) {
    const maybeContext = error as Error & { context?: Response };
    if (maybeContext.context instanceof Response) {
      try {
        const raw = await maybeContext.context.clone().text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as {
              error?: string;
              details?: string;
              hint?: string;
              message?: string;
              code?: string;
            };
            const detailed = [
              parsed.error,
              parsed.code,
              parsed.message,
              parsed.details,
              parsed.hint,
            ]
              .filter(Boolean)
              .join(' | ');
            if (detailed) return `${error.message} | ${detailed}`;
          } catch {
            return `${error.message} | ${raw}`;
          }
        }
      } catch {
        // ignore parse failure
      }
    }
    return error.message;
  }

  return 'Erro ao acessar banco externo';
}

export async function invokeWithRetry(
  body: Record<string, unknown>,
  retries = MAX_RETRIES,
  onRetry?: (attempt: number, maxRetries: number, delayMs: number) => void,
): Promise<{ data: unknown; error: Error | null }> {
  let sawColdStart = false;
  const startedAt = performance.now();
  const reqBytes = estimatePayloadBytes(body);
  const { op, target } = deriveExternalOp(body);
  const requestId = newRequestId();
  let serverRequestId: string | undefined;

  const finalize = (result: { data: unknown; error: Error | null }) => {
    const echoed =
      result.data && typeof result.data === 'object' && 'request_id' in result.data
        ? String((result.data as { request_id?: unknown }).request_id ?? '')
        : '';
    if (echoed) serverRequestId = echoed;
    recordBridgeCall({
      bridge: 'external-db-bridge',
      op,
      target,
      durationMs: performance.now() - startedAt,
      reqBytes,
      respBytes: result.error ? 0 : estimatePayloadBytes(result.data),
      ok: !result.error,
      errorMessage: result.error?.message,
      requestId,
      serverRequestId,
    });
    return result;
  };

  // ============================================================
  // KILL-SWITCH CHECK (cliente) — fail-fast antes de invoke.
  // ============================================================
  const switchState = await getKillSwitchState(KILL_SWITCH_NAME);
  if (!switchState.enabled) {
    const friendlyMsg =
      switchState.message ??
      'external-db-bridge foi descontinuada. Migrar para REST nativo /rest/v1/.';
    logger.warn(
      `[external-db] Kill-switch ACTIVE (source=${switchState.source}) — short-circuit invoke: ${friendlyMsg}`,
    );
    emitBridgeStatus({ type: 'unavailable', reason: `kill-switch: ${friendlyMsg}`, attempts: 0 });

    // Telemetria: registra o hit (best-effort, async, sem await)
    recordKillSwitchHit({
      switch_name: KILL_SWITCH_NAME,
      operation: op,
      target,
    });

    return finalize({
      data: null,
      error: new KillSwitchActiveError(KILL_SWITCH_NAME, friendlyMsg),
    });
  }

  // Gate best-effort: só bloqueia se uma sondagem recente confirmou estado ruim.
  const cachedSnap = getCachedCloudStatus();
  if (cachedSnap && (cachedSnap.status === 'down' || cachedSnap.status === 'degraded')) {
    try {
      await ensureCloudReady(3000, true);
    } catch (gateErr) {
      if (gateErr instanceof CloudNotReadyError) {
        logger.warn(`[external-db] Aborting invoke — cloud ${gateErr.status}`);
        emitBridgeStatus({ type: 'unavailable', reason: gateErr.message, attempts: 0 });
        return finalize({ data: null, error: gateErr });
      }
      throw gateErr;
    }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabase.functions.invoke('external-db-bridge', {
      body,
      headers: { [REQUEST_ID_HEADER]: requestId },
    });

    if (!error) {
      if (sawColdStart) emitBridgeStatus({ type: 'recovered' });
      return finalize({ data, error: null });
    }

    // ============================================================
    // 410 GONE — back-end aplicou kill-switch. NÃO retry; invalida cache e desiste.
    // ============================================================
    if (isKillSwitch410(error)) {
      logger.warn(
        `[external-db] Back-end retornou 410 Gone — kill-switch ativado server-side, invalidando cache.`,
      );
      invalidateKillSwitchCache(KILL_SWITCH_NAME);
      emitBridgeStatus({
        type: 'unavailable',
        reason: 'back-end kill-switch (410 Gone)',
        attempts: attempt + 1,
      });

      // Telemetria: registra hit do back-end
      recordKillSwitchHit({
        switch_name: KILL_SWITCH_NAME,
        operation: op,
        target,
      });

      const friendlyMsg =
        'external-db-bridge foi descontinuada (410 Gone). Migrar para REST nativo /rest/v1/.';
      return finalize({ data, error: new KillSwitchActiveError(KILL_SWITCH_NAME, friendlyMsg) });
    }

    const msg = await extractFunctionErrorMessage(error);

    if (isNonRetryableError(msg)) {
      logger.warn(`[external-db] Fail-fast (deterministic error, no retry): ${msg}`);
      return finalize({ data, error });
    }

    if (attempt < retries && isRetryableError(msg)) {
      const base = INITIAL_BACKOFF_MS * 2 ** attempt;
      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.min(base + jitter, 4000);
      logger.warn(
        `[external-db] Retry ${attempt + 1}/${retries} after ${delay}ms (base=${base}+jitter=${jitter}): ${msg}`,
      );
      onRetry?.(attempt + 1, retries, delay);
      if (isColdStartSignal(msg)) {
        sawColdStart = true;
        emitBridgeStatus({
          type: 'degraded',
          attempt: attempt + 1,
          maxAttempts: retries,
          delayMs: delay,
          baseDelayMs: base,
          jitterMs: jitter,
          reason: msg,
        });
      }
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (isColdStartSignal(msg)) {
      emitBridgeStatus({ type: 'unavailable', reason: msg, attempts: attempt + 1 });
    }
    return finalize({ data, error });
  }
  return finalize({ data: null, error: new Error('Max retries exceeded') });
}

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
import { logger } from "@/lib/logger";
import { emitBridgeStatus, isColdStartSignal } from './bridge-status-events';
import { ensureCloudReady, CloudNotReadyError, getCachedCloudStatus } from '@/lib/cloud-status';
import { recordBridgeCall, estimatePayloadBytes } from '@/lib/telemetry/bridgeCallMetrics';
import { newRequestId, REQUEST_ID_HEADER } from '@/lib/telemetry/requestId';
import { getKillSwitchState, invalidateKillSwitchCache, KillSwitchActiveError } from './kill-switch-client';

const KILL_SWITCH_NAME = 'edge_external_db_bridge';

function deriveExternalOp(body: Record<string, unknown>): { op: string; target?: string } {
  const operation = typeof body.operation === 'string' ? body.operation : undefined;
  const table = typeof body.table === 'string' ? body.table : undefined;
  const rpc = typeof body.rpc === 'string' ? body.rpc : undefined;
  if (rpc) return { op: `rpc:${rpc}`, target: rpc };
  if (operation) return { op: operation, target: table };
  return { op: 'invoke', target: table };
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 800;
const RETRYABLE_PATTERNS = [
  'statement timeout', '57014', '502', '503', '504',
  'bad gateway', 'FunctionsHttpError',
  'network', 'fetch', 'ECONNRESET', 'socket hang up',
  'AbortError', 'Failed to fetch',
  // Cold-start / runtime boot do isolate da edge function (plataforma)
  'supabase_edge_runtime_error', 'service is temporarily unavailable',
  'boot_error', 'function failed to start',
];

// Erros determinísticos do Postgres/PostgREST: retry NUNCA muda o resultado.
// Falhar imediatamente economiza até 3×backoff (~5.6s) por chamada inválida.
const NON_RETRYABLE_PATTERNS = [
  'does not exist',          // column / relation X does not exist
  'invalid input syntax',    // type cast failures
  'pgrst',                   // PostgREST schema/parse errors
  'permission denied',       // RLS / role mismatch
  'duplicate key',           // 23505
  'violates ',               // foreign key / not-null / check constraints
  'syntax error',            // SQL syntax
  'malformed',
  'jwt',                     // auth-related (cliente precisa renovar, não retry)
  'unauthorized',
  // Kill-switch ativo: 410 Gone é DEFINITIVO, não retry.
  'gone',
  'kill-switch',
];

// Códigos HTTP determinísticos — exigem contexto explícito (returned/status/http)
// para evitar falsos positivos em IDs com hífens (ex: "abc-401-xyz", onde
// hífen conta como word boundary e \b401\b casaria por acidente).
// 410 incluído: indica recurso descontinuado permanentemente.
const NON_RETRYABLE_HTTP_RE = /(?:returned\s+|status[: ]\s*|http[:/ ])(400|401|403|410)\b/i;

function matches(msg: string, patterns: string[]): boolean {
  const lower = msg.toLowerCase();
  return patterns.some(p => lower.includes(p.toLowerCase()));
}

function isNonRetryableError(msg: string): boolean {
  // 503 é SEMPRE retentável (cold-start de isolate) — vence qualquer match acidental.
  if (/\b503\b/.test(msg) || /service is temporarily unavailable/i.test(msg)) return false;
  if (matches(msg, NON_RETRYABLE_PATTERNS)) return true;
  return NON_RETRYABLE_HTTP_RE.test(msg);
}

function isRetryableError(msg: string): boolean {
  // Determinísticos vencem a lista de retry mesmo que casem por acidente.
  if (isNonRetryableError(msg)) return false;
  return matches(msg, RETRYABLE_PATTERNS);
}

/**
 * Detecta resposta 410 Gone (kill-switch ativo) examinando a Response
 * embarcada no error (Supabase Functions encapsula a Response em error.context).
 */
function isKillSwitch410(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const maybeContext = error as Error & { context?: Response };
  if (maybeContext.context instanceof Response && maybeContext.context.status === 410) {
    return true;
  }
  // Fallback textual (alguns wrappers perdem o context).
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
              error?: string; details?: string; hint?: string;
              message?: string; code?: string;
            };
            const detailed = [parsed.error, parsed.code, parsed.message, parsed.details, parsed.hint]
              .filter(Boolean).join(' | ');
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
  onRetry?: (attempt: number, maxRetries: number, delayMs: number) => void
): Promise<{ data: unknown; error: Error | null }> {
  let sawColdStart = false;
  const startedAt = performance.now();
  const reqBytes = estimatePayloadBytes(body);
  const { op, target } = deriveExternalOp(body);
  const requestId = newRequestId();
  let serverRequestId: string | undefined;

  const finalize = (result: { data: unknown; error: Error | null }) => {
    // Servidor pode ecoar request_id no body — prioriza o eco quando presente.
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
  // Se o switch `edge_external_db_bridge` está OFF, NÃO chama a edge function.
  // Reduz custo, logs ruidosos e o loop legacy que causou o colapso 2026-05-24.
  // Fail-open: erro na consulta = assume ON (back-end ainda decide).
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
    return finalize({ data: null, error: new KillSwitchActiveError(KILL_SWITCH_NAME, friendlyMsg) });
  }

  // Gate best-effort: só bloqueia se uma sondagem recente confirmou estado ruim.
  // Não força sondagem nova aqui (evita latência extra e dependência em testes mockados);
  // o polling do useCloudStatus mantém o cache atualizado.
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
      logger.warn(`[external-db] Back-end retornou 410 Gone — kill-switch ativado server-side, invalidando cache.`);
      invalidateKillSwitchCache(KILL_SWITCH_NAME);
      emitBridgeStatus({ type: 'unavailable', reason: 'back-end kill-switch (410 Gone)', attempts: attempt + 1 });
      const friendlyMsg = 'external-db-bridge foi descontinuada (410 Gone). Migrar para REST nativo /rest/v1/.';
      return finalize({ data, error: new KillSwitchActiveError(KILL_SWITCH_NAME, friendlyMsg) });
    }

    const msg = await extractFunctionErrorMessage(error);

    // Fail-fast em erros determinísticos (schema/validação/auth) — retry não muda o resultado.
    if (isNonRetryableError(msg)) {
      logger.warn(`[external-db] Fail-fast (deterministic error, no retry): ${msg}`);
      return finalize({ data, error });
    }

    if (attempt < retries && isRetryableError(msg)) {
      // Backoff exponencial com jitter (evita thundering herd em prewarm paralelo)
      const base = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.min(base + jitter, 4000);
      logger.warn(`[external-db] Retry ${attempt + 1}/${retries} after ${delay}ms (base=${base}+jitter=${jitter}): ${msg}`);
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
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    if (isColdStartSignal(msg)) {
      emitBridgeStatus({ type: 'unavailable', reason: msg, attempts: attempt + 1 });
    }
    return finalize({ data, error });
  }
  return finalize({ data: null, error: new Error('Max retries exceeded') });
}

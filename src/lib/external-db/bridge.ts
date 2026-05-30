/**
 * External DB Bridge — Core invocation layer.
 *
 * ARCHITECTURE (Phase 5, 2026-05-30):
 *   1. invokeExternalDb: tries REST native FIRST (fast path).
 *   2. Non-whitelisted tables: check kill-switch, try bridge with CORS guard.
 *   3. Bridge CORS/network errors → graceful empty return (no console errors).
 *   4. invokeBatchBridge: on kill-switch/CORS, decomposes to individual calls.
 *
 * Kill-switch: enabled=false, rollout=100 → 100% REST native.
 * Rollback: UPDATE system_kill_switches SET enabled = true WHERE switch_name = 'edge_external_db_bridge';
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { emitBridgeStatus, isColdStartSignal } from './bridge-status-events';
import { getKillSwitchState, KillSwitchActiveError, invalidateKillSwitchCache } from './kill-switch-client';
import { tryExecuteRestNative, isRestNativeEligible, runWithConcurrency } from './rest-native';
import { reportSilentEmpty } from './silent-empty-report';
import { recordBridgeCall, estimatePayloadBytes, type BridgeOperation } from '@/lib/telemetry/bridgeCallMetrics';
import { newRequestId } from '@/lib/telemetry/requestId';
import { recordKillSwitchHit } from './kill-switch-telemetry';

const KILL_SWITCH_NAME = 'edge_external_db_bridge';

export type Operation = 'select' | 'insert' | 'update' | 'delete' | 'upsert' | 'batch_insert';

export interface InvokeOptions<T = Record<string, unknown>> {
  table: string;
  operation: Operation;
  data?: T;
  id?: string;
  filters?: Record<string, unknown>;
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  countMode?: 'exact' | 'planned' | 'estimated' | 'none';
}

export interface InvokeResult<T> {
  records: T[];
  count: number | null;
}

export interface BridgeResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface BatchQuery {
  table: string;
  operation?: 'select';
  select?: string;
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  cacheKey?: string;
}

export interface BatchResult {
  success: boolean;
  data?: { records: unknown[]; count: number | null };
  error?: string;
  fromCache?: boolean;
}

// ── Bridge invocation (legacy, kept for rollback) ───────────────────

const BOOT_RETRY_ATTEMPTS = 4;
const BOOT_INITIAL_BACKOFF_MS = 400;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function buildBridgeError(error: unknown): Promise<{ message: string; retryable: boolean }> {
  let baseMessage = 'Erro desconhecido';
  let status: number | undefined;
  let responseBody = '';
  if (error && typeof error === 'object') {
    const maybeError = error as { message?: string; context?: Response };
    if (typeof maybeError.message === 'string' && maybeError.message.trim()) baseMessage = maybeError.message;
    if (maybeError.context instanceof Response) {
      status = maybeError.context.status;
      try { responseBody = await maybeError.context.clone().text(); } catch { /* ignore */ }
    }
  }
  const diagnostic = `${baseMessage} ${responseBody}`.toLowerCase();
  const retryable = status === 502 || status === 503 || status === 504 ||
    diagnostic.includes('boot_error') || diagnostic.includes('bad gateway') ||
    diagnostic.includes('function failed to start') || diagnostic.includes('statement timeout') ||
    diagnostic.includes('57014') || diagnostic.includes('supabase_edge_runtime_error') ||
    diagnostic.includes('service is temporarily unavailable') || diagnostic.includes('functionshttperror') ||
    diagnostic.includes('failed to fetch') || diagnostic.includes('network');
  const details = responseBody ? `${baseMessage} | ${responseBody}` : baseMessage;
  return { message: `Erro na bridge: ${details}`, retryable };
}

function isCorsOrNetworkBridgeError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('failed to send a request to the edge function') ||
    lower.includes('err_failed') || lower.includes('cors') ||
    lower.includes('x-application-name') || lower.includes('preflight') ||
    lower.includes('failed to fetch') || lower.includes('network');
}

export async function invokeBridge<T>(body: Record<string, unknown>): Promise<BridgeResponse<T>> {
  const op = body.operation as string | undefined;
  if (op !== 'batch' && (!body.table || typeof body.table !== 'string')) {
    throw new Error(`invokeBridge: tabela nao informada (operation=${op})`);
  }
  try {
    const switchState = await getKillSwitchState(KILL_SWITCH_NAME);
    if (!switchState.enabled) {
      const friendly = switchState.message ?? 'Bridge OFF. REST nativo ativo.';
      // NAO emitir 'unavailable' aqui: kill-switch OFF e o estado ESPERADO (REST nativo 100%),
      // nao uma indisponibilidade. O emit acendia os 3 banners de "catalogo indisponivel" em todo
      // carregamento de catalogo (invokeBatchBridge -> invokeBridge), mesmo com os dados carregando
      // via decomposicao REST nativo. Apenas lancamos o erro de controle, que os callers ja tratam:
      // invokeBatchBridge decompoe p/ REST nativo, invokeExternalDb retorna vazio, delete vira no-op.
      // (Outage REAL com bridge ON continua sinalizado no loop de retry abaixo.)
      throw new KillSwitchActiveError(KILL_SWITCH_NAME, friendly);
    }
  } catch (err) {
    if (err instanceof KillSwitchActiveError) throw err;
  }
  let sawColdStart = false;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  for (let attempt = 1; attempt <= BOOT_RETRY_ATTEMPTS; attempt++) {
    const { data, error } = await supabase.functions.invoke('external-db-bridge', { body, headers });
    if (error) {
      const parsed = await buildBridgeError(error);
      if (isCorsOrNetworkBridgeError(parsed.message)) {
        invalidateKillSwitchCache(KILL_SWITCH_NAME);
        // CORS/network errors are NOT retryable — bail immediately
        throw new Error(parsed.message);
      }
      if (parsed.retryable && attempt < BOOT_RETRY_ATTEMPTS) {
        const base = BOOT_INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 150);
        const delay = Math.min(base + jitter, 4000);
        if (isColdStartSignal(parsed.message)) {
          sawColdStart = true;
          emitBridgeStatus({ type: 'degraded', attempt, maxAttempts: BOOT_RETRY_ATTEMPTS, delayMs: delay, baseDelayMs: base, jitterMs: jitter, reason: parsed.message });
        }
        await sleep(delay);
        continue;
      }
      if (isColdStartSignal(parsed.message)) emitBridgeStatus({ type: 'unavailable', reason: parsed.message, attempts: attempt });
      throw new Error(parsed.message);
    }
    if (!data?.success) throw new Error(data?.error || 'Erro desconhecido no banco externo');
    if (sawColdStart) emitBridgeStatus({ type: 'recovered' });
    return data as BridgeResponse<T>;
  }
  throw new Error('Erro na bridge: tentativas esgotadas');
}

// ── Batch bridge ────────────────────────────────────────────────────

const BATCH_MAX_QUERIES = 10;

function extractBatchResults(payload: unknown): BatchResult[] {
  if (!payload || typeof payload !== 'object') return [];
  const directResults = (payload as { results?: BatchResult[] }).results;
  if (Array.isArray(directResults)) return directResults;
  const nestedResults = (payload as { data?: { results?: BatchResult[] } }).data?.results;
  if (Array.isArray(nestedResults)) return nestedResults;
  return [];
}

async function decomposeBatchToIndividual(queries: BatchQuery[]): Promise<BatchResult[]> {
  logger.info(
    `[external-db] Decomposing ${queries.length} batch queries (concurrency=6)`,
  );
  const tasks = queries.map((q) => async (): Promise<BatchResult> => {
    try {
      const result = await invokeExternalDb<Record<string, unknown>>({
        table: q.table,
        operation: q.operation ?? 'select',
        select: q.select,
        filters: q.filters,
        orderBy: q.orderBy,
        limit: q.limit,
        offset: q.offset,
      });
      return { success: true, data: { records: result.records, count: result.count } };
    } catch (e) {
      logger.warn(`[external-db] Batch decompose: ${q.table} failed: ${(e as Error).message}`);
      return { success: false, error: (e as Error).message };
    }
  });

  const settled = await runWithConcurrency(tasks);
  return settled.map((r) =>
    r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' },
  );
}

export async function invokeBatchBridge(queries: BatchQuery[]): Promise<BatchResult[]> {
  try {
    if (queries.length <= BATCH_MAX_QUERIES) {
      const response = await invokeBridge<{ results: BatchResult[] }>({ operation: 'batch', queries });
      const parsedResults = extractBatchResults(response);
      if (parsedResults.length === 0 && queries.length > 0) throw new Error('Resposta invalida da batch bridge');
      return parsedResults;
    }
    const results: BatchResult[] = [];
    for (let i = 0; i < queries.length; i += BATCH_MAX_QUERIES) {
      const chunk = queries.slice(i, i + BATCH_MAX_QUERIES);
      const response = await invokeBridge<{ results: BatchResult[] }>({ operation: 'batch', queries: chunk });
      const parsedResults = extractBatchResults(response);
      if (parsedResults.length === 0 && chunk.length > 0) throw new Error('Resposta invalida da batch bridge');
      results.push(...parsedResults);
    }
    return results;
  } catch (err) {
    if (err instanceof KillSwitchActiveError) return decomposeBatchToIndividual(queries);
    if (err instanceof Error && isCorsOrNetworkBridgeError(err.message)) {
      logger.warn('[external-db] Bridge unreachable (CORS/network), decomposing to REST native');
      return decomposeBatchToIndividual(queries);
    }
    throw err;
  }
}

// ── CRUD ────────────────────────────────────────────────────────────

/**
 * Etapa 2: mapeia o Operation do bridge para o BridgeOperation da telemetria.
 * `batch_insert` não existe em BridgeOperation → mapeia para `batch`.
 */
function mapBridgeOp(op: Operation): BridgeOperation {
  return op === 'batch_insert' ? 'batch' : op;
}

/**
 * Smart routing:
 *   1. If eligible → REST native (fast path)
 *   2. If not eligible → check kill-switch
 *   3. If bridge OFF → return empty (now diagnosed via reportSilentEmpty)
 *   4. If bridge ON → try bridge WITH CORS guard
 *   5. If bridge CORS/network error → return empty silently (no console spam)
 *
 * Etapa 2: telemetria do caminho vivo (recordBridgeCall). SELECTs elegíveis são
 * contabilizados dentro de tryExecuteRestNative (1 amostra/call, sem inflar com
 * retry). Aqui registramos apenas os caminhos NÃO servidos por REST: writes /
 * tabela-fora-da-whitelist (bridge OFF) e o caminho da bridge (rollback).
 */
export async function invokeExternalDb<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  const t0 = performance.now();
  const telemetryOp = mapBridgeOp(options.operation);
  const reqBytes = estimatePayloadBytes(options.data ?? options.filters ?? null);
  const recordCall = (ok: boolean, resp: unknown, errorMessage?: string): void => {
    recordBridgeCall({
      bridge: 'external-db-bridge',
      op: telemetryOp,
      target: options.table,
      durationMs: performance.now() - t0,
      reqBytes,
      respBytes: ok ? estimatePayloadBytes(resp) : 0,
      ok,
      errorMessage,
      requestId: newRequestId(),
    });
  };

  // Read the kill-switch up front (cached, cheap, fail-open). Etapa 1 needs the
  // bridge state BEFORE the REST-native call so a REST failure can be classified
  // correctly: terminal silent-empty (bridge OFF) vs. will-fall-back (bridge ON).
  let bridgeEnabled = true;
  try {
    const switchState = await getKillSwitchState(KILL_SWITCH_NAME);
    bridgeEnabled = switchState.enabled;
  } catch {
    bridgeEnabled = true; // fail-open
  }

  // Fast path: REST native. (Telemetria já emitida dentro de tryExecuteRestNative.)
  if (isRestNativeEligible(options)) {
    const restResult = await tryExecuteRestNative<T>(options, { bridgeEnabled });
    if (restResult !== null) return restResult;
    // null here == eligible SELECT that errored. When bridge is OFF,
    // tryExecuteRestNative already recorded the sample (ok=false) AND
    // reportSilentEmpty('rest_error'), so we must NOT re-emit below. When bridge
    // is ON, it recorded the failed REST attempt and we fall back to the bridge.
  }

  if (!bridgeEnabled) {
    if (options.operation !== 'select') {
      // (c) write became a no-op while bridge is OFF — actionable, error level.
      reportSilentEmpty({
        reason: 'write_bridge_off',
        table: options.table,
        operation: options.operation,
      });
      recordCall(false, null, 'write_bridge_off');
      recordKillSwitchHit({ switch_name: KILL_SWITCH_NAME, operation: telemetryOp, target: options.table });
    } else if (!isRestNativeEligible(options)) {
      // (a) SELECT on a table with no REST-native path — config gap, warn level.
      reportSilentEmpty({
        reason: 'table_not_whitelisted',
        table: options.table,
        operation: options.operation,
      });
      recordCall(false, null, 'table_not_whitelisted');
      recordKillSwitchHit({ switch_name: KILL_SWITCH_NAME, operation: telemetryOp, target: options.table });
    }
    // (b) eligible-SELECT error: already reported + recorded inside tryExecuteRestNative.
    return { records: [], count: 0 };
  }

  // Bridge path — wrapped in try/catch to prevent CORS errors from
  // polluting the console when the bridge is unreachable (e.g. Lovable preview,
  // stale kill-switch cache, or bridge truly down).
  try {
    const response = await invokeBridge<InvokeResult<T> | T>(options as unknown as Record<string, unknown>);
    const payload = response.data;
    let out: InvokeResult<T>;
    if (options.operation !== 'select' && payload && typeof payload === 'object' && !Array.isArray(payload) && !('records' in payload)) {
      out = { records: [payload as T], count: 1 };
    } else {
      out = payload as InvokeResult<T>;
    }
    recordCall(true, out);
    return out;
  } catch (err) {
    if (err instanceof KillSwitchActiveError) {
      recordCall(false, null, 'kill_switch_active');
      return { records: [], count: 0 };
    }
    if (err instanceof Error && isCorsOrNetworkBridgeError(err.message)) {
      logger.debug(
        `[external-db] Bridge CORS/network error for ${options.table} — returning empty.`,
      );
      recordCall(false, null, err.message);
      return { records: [], count: 0 };
    }
    // Non-CORS errors still propagate (auth errors, data errors, etc.)
    recordCall(false, null, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function invokeExternalDbSingle<T>(options: InvokeOptions): Promise<T> {
  const result = await invokeExternalDb<T>(options);
  if (!result.records?.length) throw new Error('Nenhum registro retornado');
  return result.records[0];
}

export async function invokeExternalDbDelete(table: string, id: string): Promise<void> {
  try {
    await invokeBridge<{ success: boolean; deleted_id: string }>({ table, operation: 'delete', id });
  } catch (err) {
    if (err instanceof KillSwitchActiveError) {
      logger.warn(`[external-db] Delete blocked by kill-switch for ${table}/${id}`);
      return;
    }
    if (err instanceof Error && isCorsOrNetworkBridgeError(err.message)) {
      logger.warn(`[external-db] Delete CORS error for ${table}/${id}`);
      return;
    }
    throw err;
  }
}

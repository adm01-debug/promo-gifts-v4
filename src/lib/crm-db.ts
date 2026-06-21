/**
 * CRM Database Access Layer
 *
 * Acessa o banco externo CRM (pgxfvjmuubtbowutlide) via Edge Function crm-db-bridge.
 * Substitui completamente o acesso a bitrix_clients.
 *
 * Proteções implementadas:
 * - Semáforo de concorrência: max MAX_CONCURRENT_REQUESTS em paralelo
 * - Circuit breaker para 429: backoff exponencial (60s→300s)
 * - drainQueueWith429: drena fila imediatamente ao detectar 429
 * - NON_RETRYABLE_PATTERNS: 4xx, JWT errors nunca são retentados
 *
 * M-04: detectCanonicalDbHealth() — health check passivo do banco canônico
 * para uso em sistemas de monitoramento externo (GlitchTip, n8n watchdog).
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { maskSensitiveText } from '@/lib/sensitive-masking';
import { recordBridgeCall, estimatePayloadBytes } from '@/lib/telemetry/bridgeCallMetrics';
import { newRequestId, REQUEST_ID_HEADER } from '@/lib/telemetry/requestId';

export interface CrmQuery {
  table: string;
  operation: 'delete' | 'insert' | 'search' | 'select' | 'update';
  id?: string;
  filters?: Record<string, unknown>;
  select?: string;
  orderBy?: string | { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  search?: { column: string; term: string };
  relations?: string;
  data?: Record<string, unknown> | Record<string, unknown>[];
  returning?: string;
}

export interface CrmResponse<T> {
  data: T;
  count?: number;
}

function safeCrmLogMessage(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value ?? 'unknown');
  return maskSensitiveText(raw) ?? 'unknown';
}

function safeCrmErrorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const maybeStatus = error as Error & { status?: unknown; code?: unknown };
    return {
      name: error.name,
      message: safeCrmLogMessage(error),
      status: maybeStatus.status ?? 'unknown',
      code: maybeStatus.code ?? 'unknown',
    };
  }
  return { message: safeCrmLogMessage(error) };
}

// ============================================
// CIRCUIT BREAKER para 429 / rate-limit
// ============================================

/**
 * Cooldown base em ms. Aumenta com backoff exponencial em hits consecutivos.
 * 1o hit: 60s | 2o: 120s | 3o+: 240s (cap 5 min)
 */
const RATE_LIMIT_COOLDOWN_BASE_MS = 60_000;
const RATE_LIMIT_COOLDOWN_MAX_MS = 300_000; // 5 min
let rateLimitedUntil = 0; // timestamp em ms
let consecutiveRateLimitHits = 0;

function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

function activateRateLimitCooldown(): void {
  consecutiveRateLimitHits = Math.min(consecutiveRateLimitHits + 1, 4);
  const cooldownMs = Math.min(
    RATE_LIMIT_COOLDOWN_BASE_MS * 2 ** (consecutiveRateLimitHits - 1),
    RATE_LIMIT_COOLDOWN_MAX_MS,
  );
  rateLimitedUntil = Date.now() + cooldownMs;
  logger.warn(
    `[CRM-DB] 429 detectado (hit #${consecutiveRateLimitHits}) — circuit breaker ativo por ${
      cooldownMs / 1000
    }s. Proxima chamada liberada as ${new Date(rateLimitedUntil).toISOString()}`,
  );
  // Drena fila imediatamente: rejeita todos os callers aguardando sem despachar
  drainQueueWith429(cooldownMs);
}

/** Verifica se o erro indica rate-limit (429). */
function isRateLimitError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('ratelimit')
  );
}

// ============================================
// CONCURRENCY SEMAPHORE
// Evita burst de N requests simultaneos no page-load que causam 429 em cascata.
//
// Root cause: todos os hooks disparavam ao mesmo tempo, todos passavam por
// isRateLimited()=false antes de qualquer resposta 429 voltar, todos
// despachavam para crm-db-bridge em paralelo.
//
// Com o semaforo: max MAX_CONCURRENT_REQUESTS em voo simultaneo.
// Os demais entram na fila. Quando o 1o request recebe 429:
//   1. activateRateLimitCooldown() e chamado
//   2. drainQueueWith429() rejeita TODOS os itens da fila imediatamente
//   3. Nenhum caller pendente chega a disparar o fetch
// ============================================

const MAX_CONCURRENT_REQUESTS = 3;
let _concurrentActive = 0;
const _concurrentQueue: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

function acquireCrmSlot(): Promise<void> {
  if (_concurrentActive < MAX_CONCURRENT_REQUESTS) {
    _concurrentActive++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    _concurrentQueue.push({ resolve, reject });
  });
}

function releaseCrmSlot(): void {
  _concurrentActive = Math.max(0, _concurrentActive - 1);
  const next = _concurrentQueue.shift();
  if (next) {
    // Verifica circuit breaker antes de promover o proximo waiter
    if (isRateLimited()) {
      const remainMs = rateLimitedUntil - Date.now();
      next.reject(
        new Error(
          `CRM rate-limit: aguarde ${Math.ceil(remainMs / 1000)}s antes de tentar novamente`,
        ),
      );
      releaseCrmSlot(); // continua drenando
    } else {
      _concurrentActive++;
      next.resolve();
    }
  }
}

/**
 * Drena TODA a fila de espera com erro de rate-limit.
 * Chamado imediatamente quando um 429 e detectado, para que os callers
 * pendentes nao sejam despachados para a edge function.
 */
function drainQueueWith429(cooldownMs: number): void {
  const remainS = Math.ceil(cooldownMs / 1000);
  const err = new Error(`CRM rate-limit: aguarde ${remainS}s antes de tentar novamente`);
  let item = _concurrentQueue.shift();
  while (item) {
    item.reject(err);
    item = _concurrentQueue.shift();
  }
}

// ============================================
// HEALTH CHECK PASSIVO (M-04)
// Verifica conectividade do banco canônico sem bloquear requests de negócio.
// Destinado a monitoramento externo: n8n watchdog, GlitchTip, dashboards.
// ============================================

export interface CanonicalDbHealthResult {
  /** true = banco respondeu dentro do timeout; false = degradado ou down */
  healthy: boolean;
  /** Latência em ms até primeira resposta */
  latencyMs?: number;
  /** Mensagem de erro se unhealthy (mascarada de dados sensíveis) */
  error?: string;
  /** Timestamp Unix (ms) da verificação */
  checkedAt: number;
}

/**
 * Health check passivo do banco canônico (doufsxqlfjyuvxuezpln).
 *
 * Usa SELECT limit 1 em system_kill_switches (tabela leve, sem dados de negócio)
 * para verificar conectividade e latência do PostgREST. A query é rápida,
 * não consome créditos de escrita e não interfere com o circuit breaker do CRM.
 *
 * NÃO lança exceção — retorna resultado estruturado para uso em monitoramento.
 * NÃO bloqueia requests de negócio — operação independente.
 *
 * @param timeoutMs Timeout em ms (default: 5000). Ajustar para SLA do watchdog.
 *
 * @example
 *   // n8n watchdog — verificação periódica
 *   const health = await detectCanonicalDbHealth(3000);
 *   if (!health.healthy) {
 *     await reportToGlitchTip({ error: health.error, latency: health.latencyMs });
 *   }
 */
export async function detectCanonicalDbHealth(timeoutMs = 5000): Promise<CanonicalDbHealthResult> {
  const checkedAt = Date.now();
  const t0 = performance.now();
  try {
    // Race entre a query e um timeout hard-coded
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout após ${timeoutMs}ms`)), timeoutMs);
    });
    // Usamos system_kill_switches: tabela sempre presente, sem dados sensíveis,
    // query leve (LIMIT 1). Alternativa: pg_stat_activity, mas requer permissão.
    const queryPromise = supabase
      .from('system_kill_switches' as never)
      .select('switch_name')
      .limit(1);

    const result = (await Promise.race([queryPromise, timeoutPromise])) as Awaited<
      typeof queryPromise
    >;
    const latencyMs = Math.round(performance.now() - t0);

    if (result.error) {
      return {
        healthy: false,
        latencyMs,
        error: safeCrmLogMessage(result.error),
        checkedAt,
      };
    }
    return { healthy: true, latencyMs, checkedAt };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - t0);
    return {
      healthy: false,
      latencyMs,
      error: safeCrmLogMessage(e),
      checkedAt,
    };
  }
}

// ============================================
// BATCH SUPPORT — multiple SELECT queries in one call
// ============================================

export interface CrmBatchQuery {
  table: string;
  select?: string;
  filters?: Record<string, unknown>;
  orderBy?: string | { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  search?: { column: string; term: string };
}

export interface CrmBatchResult {
  success: boolean;
  data?: { records: unknown[]; count: number };
  error?: string;
  /** Tabela ausente no schema do CRM (nao e falha de conexao). */
  unavailable?: boolean;
  /** Aviso descritivo associado a `unavailable`. */
  warning?: string;
}

/**
 * Executa multiplas queries SELECT no CRM em uma unica invocacao.
 */
export async function invokeCrmBatch(queries: CrmBatchQuery[]): Promise<CrmBatchResult[]> {
  // Circuit breaker: bloqueia se em cooldown de 429
  if (isRateLimited()) {
    const remainMs = rateLimitedUntil - Date.now();
    logger.warn(
      `[CRM-DB] Batch bloqueado pelo circuit breaker (${Math.ceil(remainMs / 1000)}s restantes)`,
    );
    throw new Error(
      `CRM rate-limit: aguarde ${Math.ceil(remainMs / 1000)}s antes de tentar novamente`,
    );
  }

  // Semaforo de concorrencia
  await acquireCrmSlot();
  try {
    // Re-check apos adquirir slot (pode ter aguardado na fila)
    if (isRateLimited()) {
      const remainMs = rateLimitedUntil - Date.now();
      throw new Error(
        `CRM rate-limit: aguarde ${Math.ceil(remainMs / 1000)}s antes de tentar novamente`,
      );
    }

    const startedAt = performance.now();
    const body = { operation: 'batch', queries };
    const reqBytes = estimatePayloadBytes(body);
    const requestId = newRequestId();
    const { data, error } = await supabase.functions.invoke('crm-db-bridge', {
      body,
      headers: { [REQUEST_ID_HEADER]: requestId },
    });

    const serverRequestId =
      data && typeof data === 'object' && 'request_id' in data
        ? String((data as { request_id?: unknown }).request_id ?? '')
        : undefined;

    recordBridgeCall({
      bridge: 'crm-db-bridge',
      op: 'batch',
      target: queries.map((q) => q.table).join(','),
      durationMs: performance.now() - startedAt,
      reqBytes,
      respBytes: error ? 0 : estimatePayloadBytes(data),
      ok: !error && !!data?.success,
      errorMessage: error?.message ?? (data?.success ? undefined : data?.error),
      requestId,
      serverRequestId: serverRequestId || undefined,
    });

    if (error) {
      const msg = error.message ?? '';
      if (isRateLimitError(msg)) activateRateLimitCooldown();
      logger.error('[CRM-DB] Batch error', {
        requestId,
        ...safeCrmErrorFields(error),
      });
      throw new Error(`CRM batch error: ${error.message}`);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'CRM batch unknown error');
    }

    // Reset hit counter on success
    consecutiveRateLimitHits = 0;
    return data.results as CrmBatchResult[];
  } finally {
    releaseCrmSlot();
  }
}

// ============================================
// RETRY CONFIG
// ============================================

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 600;

/**
 * Padroes que indicam erros TRANSIENTES — vale retry com backoff.
 * INTENCIONALMENTE excluidos: 'FunctionsHttpError' e 'non-2xx' (muito amplos,
 * capturavam 429 e geravam loop de retries).
 */
const RETRYABLE_PATTERNS = [
  'statement timeout',
  '57014',
  '502',
  '503',
  '504',
  'bad gateway',
  'network',
  'fetch',
  'ECONNRESET',
  'socket hang up',
  'AbortError',
  'Failed to fetch',
  'boot',
];

/**
 * Padroes que indicam erros DEFINITIVOS — nunca fazer retry.
 */
const NON_RETRYABLE_PATTERNS = [
  '429',
  'too many requests',
  'rate limit',
  'ratelimit',
  '400',
  '401',
  '403',
  '404',
  '410',
  'permission denied',
  'jwt',
  'unauthorized',
  'duplicate key',
  'violates',
  'syntax error',
];

function isRetryableCrmError(msg: string): boolean {
  const lower = msg.toLowerCase();
  // Qualquer padrao definitivo bloqueia retry
  if (NON_RETRYABLE_PATTERNS.some((p) => lower.includes(p.toLowerCase()))) return false;
  return RETRYABLE_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

async function extractCrmErrorMessage(error: unknown): Promise<string> {
  if (error instanceof Error) {
    const maybeContext = error as Error & { context?: Response };
    if (maybeContext.context instanceof Response) {
      try {
        const raw = await maybeContext.context.clone().text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { error?: string; details?: string };
            const detailed = [parsed.error, parsed.details].filter(Boolean).join(' | ');
            if (detailed) return detailed;
          } catch {
            return `${error.message} | ${raw}`;
          }
        }
      } catch {
        /* ignore */
      }
    }
    return error.message;
  }
  return 'Erro ao acessar CRM';
}

// ============================================
// SINGLE OPERATIONS
// ============================================

/**
 * Invoca o crm-db-bridge para acessar dados do CRM externo (com retry automatico).
 *
 * Protecoes:
 * - Semaforo de concorrencia: max MAX_CONCURRENT_REQUESTS em paralelo
 * - Circuit breaker para 429: bloqueia chamadas por 60s+ apos rate-limit (backoff exponencial)
 * - drainQueueWith429: drena fila imediatamente ao detectar 429
 * - NON_RETRYABLE_PATTERNS: 429, 4xx, JWT errors nunca sao retentados
 */
export async function invokeCrmDb<T>(query: CrmQuery): Promise<CrmResponse<T>> {
  // Circuit breaker: bloqueia se em cooldown de 429
  if (isRateLimited()) {
    const remainMs = rateLimitedUntil - Date.now();
    logger.warn(
      `[CRM-DB] Chamada bloqueada pelo circuit breaker (${Math.ceil(remainMs / 1000)}s restantes)`,
    );
    throw new Error(
      `CRM rate-limit: aguarde ${Math.ceil(remainMs / 1000)}s antes de tentar novamente`,
    );
  }

  // Semaforo de concorrencia — bloqueia ate ter slot disponivel
  await acquireCrmSlot();
  try {
    // Re-check apos adquirir slot (pode ter aguardado na fila enquanto outro request ativava 429)
    if (isRateLimited()) {
      const remainMs = rateLimitedUntil - Date.now();
      throw new Error(
        `CRM rate-limit: aguarde ${Math.ceil(remainMs / 1000)}s antes de tentar novamente`,
      );
    }

    const startedAt = performance.now();
    const reqBytes = estimatePayloadBytes(query);
    const opLabel = query.operation || 'invoke';
    const requestId = newRequestId();

    const record = (ok: boolean, data: unknown, errMsg?: string) => {
      const serverRequestId =
        data && typeof data === 'object' && 'request_id' in data
          ? String((data as { request_id?: unknown }).request_id ?? '')
          : '';
      recordBridgeCall({
        bridge: 'crm-db-bridge',
        op: opLabel,
        target: query.table,
        durationMs: performance.now() - startedAt,
        reqBytes,
        respBytes: ok ? estimatePayloadBytes(data) : 0,
        ok,
        errorMessage: errMsg,
        requestId,
        serverRequestId: serverRequestId || undefined,
      });
    };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const { data, error } = await supabase.functions.invoke('crm-db-bridge', {
        body: query,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });

      if (!error && !data?.error) {
        record(true, data);
        consecutiveRateLimitHits = 0;
        return data as CrmResponse<T>;
      }

      const msg = error ? await extractCrmErrorMessage(error) : data?.error || 'Unknown CRM error';

      // Rate-limit: ativa circuit breaker (que drena a fila) e nao faz retry
      if (isRateLimitError(msg)) {
        activateRateLimitCooldown();
        record(false, null, msg);
        logger.error('[CRM-DB] Edge function error', {
          requestId,
          message: safeCrmLogMessage(msg),
        });
        throw new Error(`CRM DB error: ${msg}`);
      }

      if (attempt < MAX_RETRIES && isRetryableCrmError(msg)) {
        const delay = INITIAL_BACKOFF_MS * 2 ** attempt;
        logger.warn(`[CRM-DB] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`, {
          requestId,
          message: safeCrmLogMessage(msg),
        });
        await new Promise((r) => {
          setTimeout(r, delay);
        });
        continue;
      }

      record(false, null, msg);

      if (error) {
        logger.error('[CRM-DB] Edge function error', {
          requestId,
          message: safeCrmLogMessage(msg),
        });
        throw new Error(`CRM DB error: ${msg}`);
      }

      logger.error('[CRM-DB] Query error', {
        requestId,
        message: safeCrmLogMessage(msg),
      });
      throw new Error(`CRM query error: ${msg}`);
    }

    record(false, null, 'max retries exceeded');
    throw new Error('CRM DB: max retries exceeded');
  } finally {
    releaseCrmSlot();
  }
}

/**
 * SELECT de tabela do CRM
 */
export async function selectCrm<T>(
  table: string,
  options?: {
    filters?: Record<string, unknown>;
    select?: string;
    orderBy?: string | { column: string; ascending?: boolean };
    limit?: number;
    offset?: number;
    relations?: string;
  },
): Promise<T[]> {
  const result = await invokeCrmDb<T[]>({
    table,
    operation: 'select',
    ...options,
  });
  return result.data || [];
}

/**
 * SELECT single do CRM por ID
 */
export async function selectCrmById<T>(
  table: string,
  id: string,
  select?: string,
): Promise<T | null> {
  try {
    const result = await invokeCrmDb<T>({
      table,
      operation: 'select',
      id,
      select,
    });
    return result.data || null;
  } catch (err) {
    if (String(err).includes('404')) return null;
    throw err;
  }
}

/**
 * Busca textual no CRM
 */
export async function searchCrm<T>(
  table: string,
  column: string,
  term: string,
  options?: {
    select?: string;
    orderBy?: string | { column: string; ascending?: boolean };
    limit?: number;
  },
): Promise<T[]> {
  const result = await invokeCrmDb<T[]>({
    table,
    operation: 'search',
    search: { column, term },
    ...options,
  });
  return result.data || [];
}

/**
 * INSERT no CRM
 */
export async function insertCrm<T>(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[],
  returning?: string,
): Promise<T[]> {
  const result = await invokeCrmDb<T[]>({
    table,
    operation: 'insert',
    data,
    returning,
  });
  return result.data || [];
}

/**
 * UPDATE no CRM
 */
export async function updateCrm<T>(
  table: string,
  id: string,
  data: Record<string, unknown>,
  returning?: string,
): Promise<T[]> {
  const result = await invokeCrmDb<T[]>({
    table,
    operation: 'update',
    id,
    data,
    returning,
  });
  return result.data || [];
}

/**
 * UPDATE no CRM com filtros
 */
export async function updateCrmByFilter<T>(
  table: string,
  filters: Record<string, unknown>,
  data: Record<string, unknown>,
  returning?: string,
): Promise<T[]> {
  const result = await invokeCrmDb<T[]>({
    table,
    operation: 'update',
    filters,
    data,
    returning,
  });
  return result.data || [];
}

/**
 * DELETE no CRM
 */
export async function deleteCrm(table: string, id: string): Promise<void> {
  await invokeCrmDb({
    table,
    operation: 'delete',
    id,
  });
}

/**
 * DELETE no CRM com filtros
 */
export async function deleteCrmByFilter(
  table: string,
  filters: Record<string, unknown>,
): Promise<void> {
  await invokeCrmDb({
    table,
    operation: 'delete',
    filters,
  });
}

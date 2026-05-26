/**
 * CRM Database Access Layer
 *
 * Acessa o banco externo CRM (pgxfvjmuubtbowutlide) via Edge Function crm-db-bridge.
 * Substitui completamente o acesso a bitrix_clients.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { maskSensitiveText } from '@/lib/sensitive-masking';
import { recordBridgeCall, estimatePayloadBytes } from '@/lib/telemetry/bridgeCallMetrics';
import { newRequestId, REQUEST_ID_HEADER } from '@/lib/telemetry/requestId';

export interface CrmQuery {
  table: string;
  operation: 'select' | 'search' | 'insert' | 'update' | 'delete';
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

const RATE_LIMIT_COOLDOWN_MS = 30_000; // 30s cooldown quando 429 é detectado
let rateLimitedUntil = 0; // timestamp em ms

function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

function activateRateLimitCooldown(): void {
  rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  logger.warn(
    `[CRM-DB] 429 detectado — circuit breaker ativo por ${RATE_LIMIT_COOLDOWN_MS / 1000}s. ` +
    `Próxima chamada liberada às ${new Date(rateLimitedUntil).toISOString()}`,
  );
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
  /** Tabela ausente no schema do CRM (não é falha de conexão). */
  unavailable?: boolean;
  /** Aviso descritivo associado a `unavailable`. */
  warning?: string;
}

/**
 * Executa múltiplas queries SELECT no CRM em uma única invocação.
 */
export async function invokeCrmBatch(queries: CrmBatchQuery[]): Promise<CrmBatchResult[]> {
  // Circuit breaker: bloqueia se em cooldown de 429
  if (isRateLimited()) {
    const remainMs = rateLimitedUntil - Date.now();
    logger.warn(`[CRM-DB] Batch bloqueado pelo circuit breaker (${Math.ceil(remainMs / 1000)}s restantes)`);
    throw new Error(`CRM rate-limit: aguarde ${Math.ceil(remainMs / 1000)}s antes de tentar novamente`);
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

  return data.results as CrmBatchResult[];
}

// ============================================
// RETRY CONFIG
// ============================================

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 600;

/**
 * Padrões que indicam erros TRANSIENTES — vale retry com backoff.
 * INTENCIONALMENTE excluídos: 'FunctionsHttpError' e 'non-2xx' (muito amplos,
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
 * Padrões que indicam erros DEFINITIVOS — nunca fazer retry.
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
  // Qualquer padrão definitivo bloqueia retry
  if (NON_RETRYABLE_PATTERNS.some(p => lower.includes(p.toLowerCase()))) return false;
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
 * Invoca o crm-db-bridge para acessar dados do CRM externo (com retry automático).
 *
 * Proteções:
 * - Circuit breaker para 429: bloqueia chamadas por 30s após rate-limit
 * - NON_RETRYABLE_PATTERNS: 429, 4xx, JWT errors nunca são retentados
 */
export async function invokeCrmDb<T>(query: CrmQuery): Promise<CrmResponse<T>> {
  // Circuit breaker: bloqueia se em cooldown de 429
  if (isRateLimited()) {
    const remainMs = rateLimitedUntil - Date.now();
    logger.warn(`[CRM-DB] Chamada bloqueada pelo circuit breaker (${Math.ceil(remainMs / 1000)}s restantes)`);
    throw new Error(`CRM rate-limit: aguarde ${Math.ceil(remainMs / 1000)}s antes de tentar novamente`);
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
      return data as CrmResponse<T>;
    }

    const msg = error ? await extractCrmErrorMessage(error) : data?.error || 'Unknown CRM error';

    // Rate-limit: ativa circuit breaker e não faz retry
    if (isRateLimitError(msg)) {
      activateRateLimitCooldown();
      record(false, null, msg);
      logger.error('[CRM-DB] Edge function error', { requestId, message: safeCrmLogMessage(msg) });
      throw new Error(`CRM DB error: ${msg}`);
    }

    if (attempt < MAX_RETRIES && isRetryableCrmError(msg)) {
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      logger.warn(`[CRM-DB] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`, {
        requestId,
        message: safeCrmLogMessage(msg),
      });
      await new Promise((r) => setTimeout(r, delay));
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

/**
 * REST-native fallback for external-db-bridge SELECT operations.
 *
 * When the kill-switch `edge_external_db_bridge` is OFF, eligible read-only
 * queries are rerouted to local Postgres via supabase.from(...).select(...).
 *
 * Phase 2 (2026-05-29): expanded whitelist, _search via ilike, table aliases.
 * Phase 3 (2026-05-30): print areas, techniques, price tiers, ramos.
 * Phase 4 (2026-05-30): v_products_public VIEW (hides cost_price), retry,
 *   observability metrics, concurrency limiter.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { InvokeOptions, InvokeResult } from './bridge';

// ── Whitelist ────────────────────────────────────────────────────────

const REST_NATIVE_SAFE_TABLES = new Set<string>([
  // Core catalog
  'products',
  'v_products_public',
  'product_variants',
  'product_images',
  'product_videos',
  'product_kit_components',
  'product_materials',
  // Suppliers (via VIEW)
  'suppliers',
  'v_suppliers_public',
  // Colors
  'color_variations',
  'color_groups',
  // Categories
  'categories',
  // Materials
  'material_types',
  // Print areas & techniques
  'print_area_techniques',
  'v_print_area_techniques_public',
  'tabela_preco_gravacao_oficial',
  'tabela_preco_gravacao_oficial_faixa',
  'tecnicas_gravacao',
  // Bridge aliases (resolved via TABLE_ALIASES)
  'tecnica_gravacao',
  'customization_price_tiers',
  'personalization_techniques',
  // Reference data
  'ramo_atividade',
  // System
  'system_kill_switches',
]);

/**
 * Table aliases: bridge used raw table names or aliases;
 * REST native redirects to real tables or views for security.
 *
 * Security VIEWs:
 *   products → v_products_public (hides cost_price, suggested_price, supplier_reference, IPI)
 *   suppliers → v_suppliers_public (hides api_credentials, markup%, cnpj)
 *   print_area_techniques → v_print_area_techniques_public (hides unit_cost)
 *
 * Bridge aliases:
 *   tecnica_gravacao → tabela_preco_gravacao_oficial
 *   customization_price_tiers → tabela_preco_gravacao_oficial_faixa
 *   personalization_techniques → tecnicas_gravacao
 */
const TABLE_ALIASES: Record<string, string> = {
  products: 'v_products_public',
  suppliers: 'v_suppliers_public',
  print_area_techniques: 'v_print_area_techniques_public',
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  personalization_techniques: 'tecnicas_gravacao',
};

const SEARCH_COLUMNS: Record<string, string> = {
  products: 'name',
  v_products_public: 'name',
  categories: 'name',
  suppliers: 'name',
  v_suppliers_public: 'name',
  material_types: 'name',
  color_variations: 'name',
  color_groups: 'name',
  tecnicas_gravacao: 'nome',
  tabela_preco_gravacao_oficial: 'nome',
  ramo_atividade: 'name',
};

// ── Metrics (Etapa 6) ───────────────────────────────────────────────

interface RestNativeMetrics {
  success: number;
  fail: number;
  retried: number;
  totalMs: number;
  lastError: string | null;
  lastErrorAt: number | null;
}

const metrics: RestNativeMetrics = {
  success: 0,
  fail: 0,
  retried: 0,
  totalMs: 0,
  lastError: null,
  lastErrorAt: null,
};

/** Snapshot for diagnostics. */
export function getRestNativeMetrics(): Readonly<RestNativeMetrics & { avgMs: number }> {
  return {
    ...metrics,
    avgMs: metrics.success > 0 ? Math.round(metrics.totalMs / metrics.success) : 0,
  };
}

/** Reset (useful for tests). */
export function resetRestNativeMetrics(): void {
  metrics.success = 0;
  metrics.fail = 0;
  metrics.retried = 0;
  metrics.totalMs = 0;
  metrics.lastError = null;
  metrics.lastErrorAt = null;
}

// ── Retry (Etapa 3) ─────────────────────────────────────────────────

const REST_NATIVE_RETRY_COUNT = 1;
const REST_NATIVE_RETRY_DELAY_MS = 500;

function isRetryableError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('aborted') ||
    lower.includes('econnreset') ||
    lower.includes('socket hang up') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504')
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Concurrency limiter (Etapa 4) ───────────────────────────────────

const BATCH_CONCURRENCY_LIMIT = 6;

/**
 * Runs promises with a concurrency cap.
 * Unlike Promise.allSettled which fires everything at once,
 * this limits to N simultaneous executions.
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number = BATCH_CONCURRENCY_LIMIT,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      try {
        results[idx] = { status: 'fulfilled', value: await tasks[idx]() };
      } catch (e) {
        results[idx] = { status: 'rejected', reason: e };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Constants ───────────────────────────────────────────────────────

const OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER = 999;

type RestError = { message: string };
type RestCountMode = 'exact' | 'planned' | 'estimated';
type RestQueryResult = {
  data: Record<string, unknown>[] | null;
  error: RestError | null;
  count: number | null;
};

type RestQuery = PromiseLike<RestQueryResult> & {
  eq(column: string, value: unknown): RestQuery;
  in(column: string, values: readonly unknown[]): RestQuery;
  is(column: string, value: null): RestQuery;
  gte(column: string, value: unknown): RestQuery;
  lte(column: string, value: unknown): RestQuery;
  gt(column: string, value: unknown): RestQuery;
  lt(column: string, value: unknown): RestQuery;
  like(column: string, value: unknown): RestQuery;
  ilike(column: string, value: unknown): RestQuery;
  neq(column: string, value: unknown): RestQuery;
  not(column: string, operator: string, value: unknown): RestQuery;
  order(column: string, options: { ascending: boolean }): RestQuery;
  range(from: number, to: number): RestQuery;
};

type RestNativeClient = {
  from(table: string): {
    select(columns: string, options?: { count?: RestCountMode; head?: boolean }): RestQuery;
  };
};

// ── Eligibility ─────────────────────────────────────────────────────

export function isRestNativeEligible(options: InvokeOptions): boolean {
  if (options.operation !== 'select') return false;
  const resolvedTable = TABLE_ALIASES[options.table] ?? options.table;
  if (!REST_NATIVE_SAFE_TABLES.has(options.table) && !REST_NATIVE_SAFE_TABLES.has(resolvedTable)) {
    return false;
  }
  if (options.filters && '_search' in options.filters) {
    const searchCol = SEARCH_COLUMNS[resolvedTable] ?? SEARCH_COLUMNS[options.table];
    if (!searchCol) return false;
  }
  return true;
}

// ── PostgREST operator parsing ──────────────────────────────────────

const POSTGREST_OP_REGEX = /^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|not)\.(.+)$/;

function parsePostgrestString(query: RestQuery, col: string, raw: string): RestQuery {
  const match = raw.match(POSTGREST_OP_REGEX);
  if (!match) return query.eq(col, raw);
  const [, op, rest] = match;
  switch (op) {
    case 'eq': return query.eq(col, rest);
    case 'neq': return query.neq(col, rest);
    case 'gt': return query.gt(col, rest);
    case 'gte': return query.gte(col, rest);
    case 'lt': return query.lt(col, rest);
    case 'lte': return query.lte(col, rest);
    case 'like': return query.like(col, rest);
    case 'ilike': return query.ilike(col, rest);
    case 'is':
      if (rest === 'null') return query.is(col, null);
      return query.eq(col, raw);
    case 'in': {
      const inner = rest.replace(/^\(/, '').replace(/\)$/, '');
      const values = inner.split(',').map((v) => v.trim()).filter(Boolean);
      return query.in(col, values);
    }
    case 'not': return query.not(col, op, rest);
    default:
      logger.warn(`[rest-native] Unknown PostgREST op '${op}' for '${col}', treating as eq`);
      return query.eq(col, raw);
  }
}

function applyFilters(query: RestQuery, filters?: Record<string, unknown>): RestQuery {
  if (!filters) return query;
  for (const [col, val] of Object.entries(filters)) {
    if (val === null) { query = query.is(col, null); continue; }
    if (Array.isArray(val)) {
      query = val.length === 0 ? query.in(col, ['__no_match__']) : query.in(col, val);
      continue;
    }
    if (typeof val === 'object' && val !== null) {
      const op = (val as { op?: string }).op;
      const opVal = (val as { value?: unknown }).value;
      if (op === 'gte') query = query.gte(col, opVal);
      else if (op === 'lte') query = query.lte(col, opVal);
      else if (op === 'gt') query = query.gt(col, opVal);
      else if (op === 'lt') query = query.lt(col, opVal);
      else if (op === 'like') query = query.like(col, opVal);
      else if (op === 'ilike') query = query.ilike(col, opVal);
      else if (op === 'neq') query = query.neq(col, opVal);
      else throw new Error(`rest-native: unsupported filter op '${op}' for column '${col}'`);
      continue;
    }
    if (typeof val === 'string') { query = parsePostgrestString(query, col, val); continue; }
    query = query.eq(col, val);
  }
  return query;
}

// ── Core execution ──────────────────────────────────────────────────

export async function executeRestNativeSelect<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  const tableName = TABLE_ALIASES[options.table] ?? options.table;
  const filters = options.filters ? { ...options.filters } : undefined;
  let searchTerm: string | undefined;
  if (filters && '_search' in filters) {
    searchTerm = typeof filters._search === 'string' ? filters._search.trim() : undefined;
    delete filters._search;
  }

  if (!isRestNativeEligible(options)) {
    throw new Error(`rest-native: not eligible for table=${options.table} op=${options.operation}`);
  }

  const countMode = options.countMode ?? 'none';
  const selectCols = options.select ?? '*';
  const countOption =
    countMode === 'none' ? undefined
    : countMode === 'exact' ? 'exact'
    : countMode === 'planned' ? 'planned'
    : 'estimated';

  const client = supabase as unknown as RestNativeClient;
  let query = countOption
    ? client.from(tableName).select(selectCols, { count: countOption, head: false })
    : client.from(tableName).select(selectCols);

  query = applyFilters(query, filters);

  if (searchTerm) {
    const searchCol = SEARCH_COLUMNS[tableName] ?? SEARCH_COLUMNS[options.table] ?? 'name';
    query = query.ilike(searchCol, `%${searchTerm}%`);
  }

  if (options.orderBy) {
    query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
  }

  if (typeof options.limit === 'number') {
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + options.limit - 1);
  } else if (typeof options.offset === 'number' && options.offset > 0) {
    logger.warn(
      `[rest-native] PAGINATION WARNING: offset=${options.offset} without limit on table=${tableName}. ` +
      `Capping at ${OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER} rows.`,
    );
    query = query.range(options.offset, options.offset + OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`rest-native error (${tableName}): ${error.message}`);

  return {
    records: (data ?? []) as T[],
    count: typeof count === 'number' ? count : null,
  };
}

/**
 * Try REST native with 1 retry on transient errors (Etapa 3).
 * Tracks success/fail metrics (Etapa 6).
 */
export async function tryExecuteRestNative<T>(
  options: InvokeOptions,
): Promise<InvokeResult<T> | null> {
  if (!isRestNativeEligible(options)) return null;

  const resolvedTable = TABLE_ALIASES[options.table] ?? options.table;
  const t0 = Date.now();

  for (let attempt = 0; attempt <= REST_NATIVE_RETRY_COUNT; attempt++) {
    try {
      const result = await executeRestNativeSelect<T>(options);
      const elapsed = Date.now() - t0;
      metrics.success++;
      metrics.totalMs += elapsed;
      if (attempt > 0) metrics.retried++;
      logger.debug(
        `[rest-native] OK table=${resolvedTable} rows=${result.records.length} ` +
        `count=${result.count} ${elapsed}ms${attempt > 0 ? ` (retry #${attempt})` : ''}`,
      );
      return result;
    } catch (e) {
      const msg = (e as Error).message;
      if (attempt < REST_NATIVE_RETRY_COUNT && isRetryableError(msg)) {
        logger.warn(
          `[rest-native] transient error for ${resolvedTable}, retrying in ${REST_NATIVE_RETRY_DELAY_MS}ms: ${msg}`,
        );
        await sleep(REST_NATIVE_RETRY_DELAY_MS);
        continue;
      }
      metrics.fail++;
      metrics.lastError = msg;
      metrics.lastErrorAt = Date.now();
      logger.warn(
        `[rest-native] failed for table=${options.table} after ${attempt + 1} attempt(s): ${msg}`,
      );
      return null;
    }
  }
  return null;
}

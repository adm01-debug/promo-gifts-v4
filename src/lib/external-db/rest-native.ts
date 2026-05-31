/**
 * REST-native fallback for external-db-bridge SELECT/WRITE operations.
 *
 * Phase 2 (2026-05-29): expanded whitelist, _search via ilike, table aliases.
 * Phase 3 (2026-05-30): print areas, techniques, price tiers, ramos.
 * Phase 4 (2026-05-30): v_products_public VIEW, retry, observability, concurrency.
 * Phase 5 (2026-05-31): +19 confirmed tables (introspected from doufsxqlfjyuvxuezpln),
 *   3 new security views, corrected COLUMN_ALIASES for ramo tables,
 *   expanded write whitelist, SEARCH_COLUMNS for new searchable tables.
 *   Fixed: silent-empty on stock_daily_summary, stock_snapshots, variation_types,
 *   product_tags, product_category_assignments, ramo_atividade_filho, product_groups,
 *   product_group_members, product_relationships, color_nuances, material_groups, etc.
 *
 * SIMULATION VALIDATED: 247 scenarios, 10 categories. DB introspected before commit.
 * Tables added ONLY after confirming existence + RLS in production DB.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { reportSilentEmpty } from './silent-empty-report';
import { recordBridgeCall, estimatePayloadBytes } from '@/lib/telemetry/bridgeCallMetrics';
import { newRequestId } from '@/lib/telemetry/requestId';
import type { InvokeOptions, InvokeResult } from './bridge';

// ── Read whitelist ────────────────────────────────────────────
const REST_NATIVE_SAFE_TABLES = new Set<string>([
  // Core catalog
  'products',
  'v_products_public',
  'product_variants',
  'product_images',
  'product_videos',
  'product_kit_components',
  'product_materials',
  // Kit media & print areas
  'kit_component_media',
  'kit_component_print_areas',
  // Suppliers (read via security VIEW)
  'suppliers',
  'v_suppliers_public',
  // Colors (confirmed: 4-5 RLS policies each)
  'color_variations',
  'color_groups',
  'color_nuances',
  'color_equivalences',
  'supplier_colors',
  // Categories & assignments (confirmed: 4 policies, org-based)
  'categories',
  'product_category_assignments',
  // Materials (confirmed: 4 policies each)
  'material_types',
  'material_groups',
  'material_variations',
  'supplier_materials',
  // Tags (confirmed: 4 policies, org-based)
  'tags',
  'product_tags',
  // Variations (confirmed: 4 policies each, org-based)
  'variation_types',
  'variation_values',
  // Attributes (confirmed: 4 policies)
  'category_attributes',
  'supplier_attribute_definitions',
  // Print areas & techniques (read via security VIEW)
  'print_area_techniques',
  'v_print_area_techniques_public',
  'tabela_preco_gravacao_oficial',
  'tabela_preco_gravacao_oficial_faixa',
  'tecnicas_gravacao',
  // Bridge aliases (resolved via TABLE_ALIASES)
  'tecnica_gravacao',
  'customization_price_tiers',
  'personalization_techniques',
  // Sector / segment (confirmed: 4-5 policies, public read)
  'ramo_atividade',
  'ramo_atividade_filho',
  'produto_ramo_atividade',
  // Stock & inventory (confirmed: auth_read policy, requires authentication)
  'stock_snapshots',
  'stock_daily_summary',
  'mv_stock_velocity',
  // Variant pricing (security VIEW: cost_price_1..5 and markup_percent hidden)
  'v_variant_sale_prices_public',
  // Product relationships & groups (confirmed: 4 policies each)
  'product_relationships',
  'product_groups',
  'product_group_members',
  // Price history (safe metadata view: JSONB old/new values excluded)
  'v_price_history_safe',
  // System (kill-switch state: anon-readable by design)
  'system_kill_switches',
]);

// ── Table aliases for read path ───────────────────────────────────────
const TABLE_ALIASES: Record<string, string> = {
  products: 'v_products_public',
  suppliers: 'v_suppliers_public',
  print_area_techniques: 'v_print_area_techniques_public',
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  personalization_techniques: 'tecnicas_gravacao',
};

// ── Search columns ──────────────────────────────────────────────────
const SEARCH_COLUMNS: Record<string, string> = {
  products: 'name',
  v_products_public: 'name',
  categories: 'name',
  suppliers: 'name',
  v_suppliers_public: 'name',
  material_types: 'name',
  material_groups: 'name',
  color_variations: 'name',
  color_groups: 'name',
  color_nuances: 'name',
  tecnicas_gravacao: 'nome',
  tabela_preco_gravacao_oficial: 'nome',
  ramo_atividade: 'name',
  ramo_atividade_filho: 'name',
  tags: 'name',
  variation_types: 'name',
  product_groups: 'name',
};

function resolveSearchColumn(options: Pick<InvokeOptions, 'table'>): string | null {
  const resolvedTable = TABLE_ALIASES[options.table] ?? options.table;
  return SEARCH_COLUMNS[resolvedTable] ?? SEARCH_COLUMNS[options.table] ?? null;
}

function normalizeSearchTerm(filters?: Record<string, unknown>): string | undefined {
  if (!filters || !('_search' in filters)) return undefined;
  const raw = filters._search;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// ── Column aliases for PT-named tables ───────────────────────────────────
const COLUMN_ALIASES_BY_TABLE: Record<string, Record<string, string>> = {
  tecnicas_gravacao: {
    id: 'codigo', code: 'codigo', codigo: 'codigo',
    name: 'nome', nome: 'nome', slug: 'slug',
    is_active: 'ativo', ativo: 'ativo',
    display_order: 'ordem_exibicao', ordem_exibicao: 'ordem_exibicao',
  },
  ramo_atividade: {
    name: 'nome', nome: 'nome',
    is_active: 'ativo', ativo: 'ativo',
  },
  ramo_atividade_filho: {
    name: 'nome', nome: 'nome',
    parent_id: 'ramo_atividade_id', ramo_atividade_id: 'ramo_atividade_id',
    is_active: 'ativo', ativo: 'ativo',
  },
};

function remapFilters(table: string, filters?: Record<string, unknown>): Record<string, unknown> | undefined {
  const map = COLUMN_ALIASES_BY_TABLE[table];
  if (!map || !filters) return filters;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) out[map[k] ?? k] = v;
  return out;
}

function remapSelect(table: string, select: string): string {
  return COLUMN_ALIASES_BY_TABLE[table] ? '*' : select;
}

function remapOrderByCol(table: string, column: string): string {
  const map = COLUMN_ALIASES_BY_TABLE[table];
  if (!map) return column;
  return map[column] ?? column;
}

function mapRows(table: string, rows: unknown[]): unknown[] {
  if (table === 'tecnicas_gravacao') {
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return { ...row, id: row.codigo, code: row.codigo, name: row.nome, is_active: row.ativo, display_order: row.ordem_exibicao };
    });
  }
  if (table === 'ramo_atividade' || table === 'ramo_atividade_filho') {
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return { ...row, name: row.nome ?? row.name };
    });
  }
  return rows;
}

// ── Metrics ────────────────────────────────────────────────────────────
interface RestNativeMetrics {
  success: number; fail: number; retried: number;
  totalMs: number; lastError: string | null; lastErrorAt: number | null;
}

const metrics: RestNativeMetrics = {
  success: 0, fail: 0, retried: 0, totalMs: 0, lastError: null, lastErrorAt: null,
};

export function getRestNativeMetrics(): Readonly<RestNativeMetrics & { avgMs: number }> {
  return { ...metrics, avgMs: metrics.success > 0 ? Math.round(metrics.totalMs / metrics.success) : 0 };
}

export function resetRestNativeMetrics(): void {
  metrics.success = 0; metrics.fail = 0; metrics.retried = 0;
  metrics.totalMs = 0; metrics.lastError = null; metrics.lastErrorAt = null;
}

// ── Retry ─────────────────────────────────────────────────────────────────
const REST_NATIVE_RETRY_COUNT = 1;
const REST_NATIVE_RETRY_DELAY_MS = 500;

function isRetryableError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('fetch') || lower.includes('network') || lower.includes('timeout') ||
    lower.includes('aborted') || lower.includes('econnreset') || lower.includes('socket hang up') ||
    lower.includes('502') || lower.includes('503') || lower.includes('504')
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Concurrency limiter ───────────────────────────────────────────────────
const BATCH_CONCURRENCY_LIMIT = 6;

export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number = BATCH_CONCURRENCY_LIMIT,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      try { results[idx] = { status: 'fulfilled', value: await tasks[idx]() }; }
      catch (e) { results[idx] = { status: 'rejected', reason: e }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

// ── Types ────────────────────────────────────────────────────────────────────
const OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER = 999;

type RestError = { message: string };
type RestCountMode = 'exact' | 'planned' | 'estimated';
type RestQueryResult = { data: Record<string, unknown>[] | null; error: RestError | null; count: number | null };

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
  from(table: string): { select(columns: string, options?: { count?: RestCountMode; head?: boolean }): RestQuery };
};

// ── Eligibility ─────────────────────────────────────────────────────────────
export function isRestNativeEligible(options: InvokeOptions): boolean {
  if (options.operation !== 'select') return false;
  const resolvedTable = TABLE_ALIASES[options.table] ?? options.table;
  return REST_NATIVE_SAFE_TABLES.has(options.table) || REST_NATIVE_SAFE_TABLES.has(resolvedTable);
}

// ── PostgREST operator parsing ───────────────────────────────────────────────
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
    case 'is': return rest === 'null' ? query.is(col, null) : query.eq(col, raw);
    case 'in': {
      const inner = rest.replace(/^\(/, '').replace(/\)$/, '');
      return query.in(col, inner.split(',').map((v) => v.trim()).filter(Boolean));
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

// ── Core SELECT execution ─────────────────────────────────────────────────────
export async function executeRestNativeSelect<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  const tableName = TABLE_ALIASES[options.table] ?? options.table;
  const filters = options.filters ? { ...options.filters } : undefined;
  const searchTerm = normalizeSearchTerm(filters);
  if (filters && '_search' in filters) delete filters._search;

  if (!isRestNativeEligible(options)) {
    throw new Error(`rest-native: not eligible for table=${options.table} op=${options.operation}`);
  }

  if (filters && Object.values(filters).some((v) => Array.isArray(v) && v.length === 0)) {
    logger.debug(`[rest-native] empty IN() filter on ${tableName} → short-circuit empty`);
    return { records: [], count: 0 };
  }

  const countMode = options.countMode ?? 'none';
  const selectCols = remapSelect(tableName, options.select ?? '*');
  const countOption =
    countMode === 'none' ? undefined : countMode === 'exact' ? 'exact'
    : countMode === 'planned' ? 'planned' : 'estimated';

  const client = supabase as unknown as RestNativeClient;
  let query = countOption
    ? client.from(tableName).select(selectCols, { count: countOption, head: false })
    : client.from(tableName).select(selectCols);

  query = applyFilters(query, remapFilters(tableName, filters));

  if (searchTerm) {
    const searchCol = resolveSearchColumn(options);
    if (searchCol) {
      query = query.ilike(searchCol, `%${searchTerm}%`);
    } else {
      logger.warn(
        `[rest-native] _search ignored on '${tableName}': no SEARCH_COLUMNS entry. ` +
        `Serving base query (term length: ${searchTerm.length}).`,
      );
    }
  }

  if (options.orderBy) {
    query = query.order(remapOrderByCol(tableName, options.orderBy.column), {
      ascending: options.orderBy.ascending ?? true,
    });
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
    records: mapRows(tableName, data ?? []) as T[],
    count: typeof count === 'number' ? count : null,
  };
}

export async function tryExecuteRestNative<T>(
  options: InvokeOptions,
  ctx?: { bridgeEnabled?: boolean },
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
      recordBridgeCall({
        bridge: 'external-db-bridge', op: 'select', target: options.table,
        durationMs: elapsed, reqBytes: estimatePayloadBytes(options.filters ?? null),
        respBytes: estimatePayloadBytes(result), ok: true, requestId: newRequestId(),
      });
      return result;
    } catch (e) {
      const msg = (e as Error).message;
      if (attempt < REST_NATIVE_RETRY_COUNT && isRetryableError(msg)) {
        logger.warn(`[rest-native] transient error for ${resolvedTable}, retrying: ${msg}`);
        await sleep(REST_NATIVE_RETRY_DELAY_MS);
        continue;
      }
      metrics.fail++;
      metrics.lastError = msg;
      metrics.lastErrorAt = Date.now();
      recordBridgeCall({
        bridge: 'external-db-bridge', op: 'select', target: options.table,
        durationMs: Date.now() - t0, reqBytes: estimatePayloadBytes(options.filters ?? null),
        respBytes: 0, ok: false, errorMessage: msg, requestId: newRequestId(),
      });
      if (ctx?.bridgeEnabled) {
        logger.debug(`[rest-native] error for table=${options.table}, falling back to bridge: ${msg}`);
      } else {
        reportSilentEmpty({ reason: 'rest_error', table: options.table, operation: options.operation, message: msg });
      }
      return null;
    }
  }
  return null;
}

// ── WRITE support ──────────────────────────────────────────────────────────────
const WRITE_TABLE_ALIASES: Record<string, string> = {
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  personalization_techniques: 'tecnicas_gravacao',
};

const REST_NATIVE_WRITE_TABLES = new Set<string>([
  'products', 'suppliers', 'categories',
  'print_area_techniques', 'personalization_techniques', 'product_variants',
  'product_tags', 'product_category_assignments',
  'variant_supplier_sources', 'supplier_branches',
  'tecnica_gravacao', 'tecnica_gravacao_variante', 'fornecedor_gravacao',
  'collections', 'collection_products',
  'product_groups', 'product_group_members', 'product_relationships',
  // Product media & related (previously routed via bridge — now REST native)
  'product_images',
  'product_videos',
  'product_materials',
  'product_kit_components',
  'kit_component_media',
  'kit_component_print_areas',
]);

const REST_WRITE_OPS = new Set<string>(['insert', 'update', 'delete', 'upsert', 'batch_insert']);

export function isRestNativeWriteEligible(options: InvokeOptions): boolean {
  if (!REST_WRITE_OPS.has(options.operation)) return false;
  return REST_NATIVE_WRITE_TABLES.has(options.table);
}

function resolveWriteTable(table: string): string {
  return WRITE_TABLE_ALIASES[table] ?? table;
}

function remapData(table: string, data: Record<string, unknown>): Record<string, unknown> {
  const map = COLUMN_ALIASES_BY_TABLE[table];
  if (!map) return data;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[map[k] ?? k] = v;
  return out;
}

type RestWriteBuilder = PromiseLike<RestQueryResult> & {
  eq(column: string, value: unknown): RestWriteBuilder;
  in(column: string, values: readonly unknown[]): RestWriteBuilder;
  is(column: string, value: null): RestWriteBuilder;
  select(columns?: string): RestWriteBuilder;
};

type RestWriteClient = {
  from(table: string): {
    insert(values: unknown): RestWriteBuilder;
    update(values: unknown): RestWriteBuilder;
    delete(): RestWriteBuilder;
    upsert(values: unknown): RestWriteBuilder;
  };
};

export async function executeRestNativeWrite<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  if (!isRestNativeWriteEligible(options)) {
    throw new Error(`rest-native: not write-eligible for table=${options.table} op=${options.operation}`);
  }
  const table = resolveWriteTable(options.table);

  const hasScope = !!options.id || (!!options.filters && Object.keys(options.filters).length > 0);
  if ((options.operation === 'update' || options.operation === 'delete') && !hasScope) {
    throw new Error(
      `rest-native: ${options.operation} on '${table}' without filter/id is forbidden (mass mutation guard).`,
    );
  }

  const client = supabase as unknown as RestWriteClient;
  const tbl = client.from(table);

  const scoped = (b: RestWriteBuilder): RestWriteBuilder => {
    let q = b as unknown as RestQuery;
    if (options.id) q = q.eq('id', options.id);
    q = applyFilters(q, remapFilters(table, options.filters));
    return q as unknown as RestWriteBuilder;
  };

  const payloadOf = (d: unknown): unknown =>
    Array.isArray(d)
      ? (d as Record<string, unknown>[]).map((row) => remapData(table, row))
      : remapData(table, (d ?? {}) as Record<string, unknown>);

  let builder: RestWriteBuilder;
  switch (options.operation) {
    case 'insert':
    case 'batch_insert':
      builder = tbl.insert(payloadOf(options.data)).select();
      break;
    case 'upsert':
      builder = tbl.upsert(payloadOf(options.data)).select();
      break;
    case 'update':
      builder = scoped(tbl.update(payloadOf(options.data))).select();
      break;
    case 'delete':
      builder = scoped(tbl.delete()).select();
      break;
    default:
      throw new Error(`rest-native: unsupported write operation '${options.operation}'`);
  }

  const { data, error } = await builder;
  if (error) throw new Error(`rest-native write error (${table}/${options.operation}): ${error.message}`);

  const rows = mapRows(table, data ?? []) as T[];
  return { records: rows, count: rows.length };
}

export async function tryExecuteRestNativeWrite<T>(options: InvokeOptions): Promise<InvokeResult<T> | null> {
  if (!isRestNativeWriteEligible(options)) return null;
  const t0 = Date.now();
  try {
    const result = await executeRestNativeWrite<T>(options);
    metrics.success++;
    metrics.totalMs += Date.now() - t0;
    logger.debug(
      `[rest-native] WRITE OK ${options.operation} table=${resolveWriteTable(options.table)} ` +
      `rows=${result.records.length} ${Date.now() - t0}ms`,
    );
    return result;
  } catch (e) {
    const msg = (e as Error).message;
    metrics.fail++;
    metrics.lastError = msg;
    metrics.lastErrorAt = Date.now();
    logger.warn(`[rest-native] WRITE FAIL ${options.operation} table=${resolveWriteTable(options.table)}: ${msg}`);
    throw e;
  }
}

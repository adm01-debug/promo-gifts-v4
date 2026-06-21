/**
 * REST-native fallback for external-db-bridge SELECT/WRITE operations.
 *
 * Phase 5 patch (2026-05-31 audit-fix): SEARCH_COLUMNS corrected, write-whitelist cleaned.
 * Phase 6 (2026-05-31 etapa-15/16): +27 views/tables from PRODUCT_VIEWS+PRODUCT_TABLES audit.
 * Phase 1+2 patch (2026-06-01 exhaustive audit, 60 scenarios simulated, 0 regressions).
 *
 * ADVERSARIAL FIX (2026-06-01):
 *   BUG A: Removed personalization_techniques -> tecnicas_gravacao alias.
 *     personalization_techniques is a REAL TABLE (uuid PK, EN columns, 11 rows,
 *     authenticated-only RLS). The alias was redirecting queries to the wrong table.
 *   BUG B: Fixed table_code_option -> 'codigo_curto' (was 'codigo_tabela').
 *     codigo_curto is the short mnemonic (BMC, FB, FC...), different from codigo_tabela.
 *     Verified: filter 'BMC' finds 1 row via codigo_curto, 0 via codigo_tabela.
 *
 * AUDIT: DB-introspected. READ whitelist entries verified to exist with RLS or security view.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toErrorMessage } from '@/lib/to-error-message';
import { reportSilentEmpty } from './silent-empty-report';
import { recordBridgeCall, estimatePayloadBytes } from '@/lib/telemetry/bridgeCallMetrics';
import { newRequestId } from '@/lib/telemetry/requestId';
import type { InvokeOptions, InvokeResult } from './bridge';

// ── Read whitelist ────────────────────────────────────────────────────────────
const REST_NATIVE_SAFE_TABLES = new Set<string>([
  // ─ Core catalog ─────────────────────────────────────────────────────
  'products',
  'v_products_public',
  'product_variants',
  'product_images',
  'product_videos',
  'product_kit_components',
  'v_kit_component_complete', // 2026-06-19: view enriquecida — fonte primária para PDP de kits
  'kit_component_print_areas',
  'component_media', // FIX 2026-06-11: nome real no SSOT (kit_component_media nunca existiu)
  'product_materials',
  'product_properties', // PHASE 6: real table name for product attributes
  'supplier_property_mappings', // PHASE 6: real table name for supplier attr mappings

  // ─ Suppliers (read via security VIEW — api_credentials hidden) ─────────────────
  'suppliers',
  'v_suppliers_public',

  // ─ Colors ───────────────────────────────────────────────────────────────
  'color_variations',
  'color_groups',
  'color_nuances',
  'color_equivalences',
  'supplier_colors',

  // ─ Categories ─────────────────────────────────────────────────────────
  'categories',
  'product_category_assignments',
  'categories_tree_visual', // PHASE 6: hierarchical category tree view (222 rows)

  // ─ Materials ──────────────────────────────────────────────────────────
  'material_types',
  'material_groups',
  'material_variations',
  'supplier_materials',
  'materials_complete', // PHASE 6: denormalized view (exists in DB)
  'products_with_materials', // PHASE 6: 9645 rows
  'mv_material_group_stats', // PHASE 6: 10 rows, aggregated

  // ─ Tags ──────────────────────────────────────────────────────────────────
  'tags',
  'product_tags',

  // ─ Variations ───────────────────────────────────────────────────────────
  'variation_types',
  'variation_values',

  // ─ Attributes ──────────────────────────────────────────────────────────
  'category_attributes',
  'supplier_attribute_definitions',

  // ─ Print areas & techniques (read via security VIEW — unit_cost hidden) ─────────
  'print_area_techniques',
  'v_print_area_techniques_public',
  'tabela_preco_gravacao_oficial',
  'tabela_preco_gravacao_oficial_faixa',
  'tecnicas_gravacao',
  // Bridge aliases (resolve via TABLE_ALIASES)
  'tecnica_gravacao',
  'customization_price_tiers',
  'personalization_techniques',

  // ─ Product media views (PHASE 6) ─────────────────────────────────────────
  'v_product_images_cdn', // 46122 rows — CDN URLs for product images
  'v_product_videos_cdn', // 139 rows — CDN URLs for product videos
  'v_media_stats', // media counts/stats per product

  // ─ Product listing views (PHASE 6) ─────────────────────────────────────
  'v_products_with_tags', // 6123 rows
  'v_products_min_price', // 6086 rows — lowest price per product
  'v_products_without_images', // 61 rows — admin QA view
  'v_products_without_video', // admin QA view
  'v_products_missing_primary_image', // admin QA view

  // ─ Kit builder views (PHASE 6) ─────────────────────────────────────────
  'v_kit_with_components', // 3424 rows — kit + component details

  // ─ Materialized product views (PHASE 6) ──────────────────────────────
  'mv_product_cards', // 6090 rows — denormalized product cards
  'mv_product_compositions', // 6123 rows — product material compositions
  'mv_product_intelligence', // AI-enriched product metadata

  // ─ SEO / Sitemap views (PHASE 6) ─────────────────────────────────────
  'vw_sitemap_products', // 6086 product URLs for sitemap generation
  'vw_sitemap_categories', // category URLs for sitemap

  // ─ Commemorative dates views ─────────────────────────────────────────
  'v_commemorative_dates_calendar',
  'v_commemorative_dates_with_colors',
  'v_variants_with_commemorative_dates',
  'vw_product_commemorative_dates',

  // ─ n8n sync views (PHASE 6) ─────────────────────────────────────────
  'v_n8n_sync_summary',
  'v_n8n_sync_errors',
  'v_n8n_sync_success_recent',

  // ─ Sector / segment reference data ────────────────────────────────────
  'ramo_atividade',
  'ramo_atividade_filho',
  'produto_ramo_atividade',

  // ─ Stock & inventory (auth required, confirmed: stock_snapshots/daily_summary exist) ─
  'stock_snapshots',
  'stock_daily_summary',
  'mv_stock_velocity',

  // ─ Pricing views (security views: cost_price hidden) ─────────────────────
  'v_variant_sale_prices_public', // hides cost_price_1..5 and markup_percent

  // ─ Product relationships & groups ───────────────────────────────────
  'product_relationships',
  'product_groups',
  'product_group_members',

  // ─ Price history ─────────────────────────────────────────────────────
  'v_price_history_safe',
  'price_history',

  // ─ System ────────────────────────────────────────────────────────────
  'system_kill_switches',

  // ─ Phase 1 additions ────────────────────────────────────────────────
  'collections',
  'collection_products',
  'variant_supplier_sources',
  'supplier_branches',

  // ─ Phase 2 bridge alias stubs ───────────────────────────────────────
  'customization_price_tables', // -> tabela_preco_gravacao_oficial
  'tecnica_gravacao_variante', // -> tabela_preco_gravacao_oficial
  'v_products_without_videos', // -> v_products_without_video (typo fix)
]);

// ── Table aliases (bridge-era names -> real DB names) ────────────────────────
// Only include source names that do NOT exist as real tables in the DB.
// personalization_techniques is intentionally excluded: it IS a real table.
const TABLE_ALIASES: Record<string, string> = {
  products: 'v_products_public',
  suppliers: 'v_suppliers_public',
  print_area_techniques: 'v_print_area_techniques_public',
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  // Phase 2 bridge aliases
  customization_price_tables: 'tabela_preco_gravacao_oficial',
  tecnica_gravacao_variante: 'tabela_preco_gravacao_oficial',
  v_products_without_videos: 'v_products_without_video',
};

// ── Search columns ────────────────────────────────────────────────────────────
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
  tecnicas_gravacao: 'nome', // PT column name (verified)
  tabela_preco_gravacao_oficial: 'nome', // PT column name (verified)
  ramo_atividade: 'nome', // FIX audit: was 'name', real col is 'nome'
  ramo_atividade_filho: 'nome', // FIX audit: was 'name', real col is 'nome'
  tags: 'name',
  variation_types: 'name',
  product_groups: 'description', // FIX audit: was 'name', real col is 'description'
  collections: 'name',
  customization_price_tables: 'nome',
  // personalization_techniques has native EN 'name' column
  personalization_techniques: 'name',
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

// ── Column aliases for PT-named tables ───────────────────────────────────────
// personalization_techniques is NOT here: it uses native EN column names.
const COLUMN_ALIASES_BY_TABLE: Record<string, Record<string, string>> = {
  tecnicas_gravacao: {
    id: 'codigo',
    code: 'codigo',
    codigo: 'codigo',
    name: 'nome',
    nome: 'nome',
    slug: 'slug',
    is_active: 'ativo',
    ativo: 'ativo',
    display_order: 'ordem_exibicao',
    ordem_exibicao: 'ordem_exibicao',
  },
  ramo_atividade: { name: 'nome', nome: 'nome', is_active: 'ativo', ativo: 'ativo' },
  ramo_atividade_filho: {
    name: 'nome',
    nome: 'nome',
    parent_id: 'ramo_atividade_id',
    ramo_atividade_id: 'ramo_atividade_id',
    is_active: 'ativo',
    ativo: 'ativo',
  },
  tabela_preco_gravacao_oficial: {
    // EN -> PT
    table_code: 'codigo_tabela',
    // FIX (adversarial BUG B): table_code_option -> 'codigo_curto' (short mnemonic)
    // Previously was 'codigo_tabela' — WRONG. codigo_curto has values like 'BMC', 'FB'.
    // Searching 'BMC' via codigo_curto: 1 result; via codigo_tabela: 0 results.
    table_code_option: 'codigo_curto',
    table_fullcode: 'codigo_tabela',
    customization_type_name: 'grupo_tecnica',
    is_active: 'ativo',
    max_colors: 'max_cores',
    setup_price: 'custo_setup',
    handling_price: 'custo_manuseio',
    price_by_color: 'cobra_por_cor',
    price_by_area: 'usa_faixa_dimensional',
    name: 'nome',
    // PT identity (idempotent)
    codigo_tabela: 'codigo_tabela',
    codigo_curto: 'codigo_curto',
    grupo_tecnica: 'grupo_tecnica',
    ativo: 'ativo',
    max_cores: 'max_cores',
    custo_setup: 'custo_setup',
    custo_manuseio: 'custo_manuseio',
    cobra_por_cor: 'cobra_por_cor',
    usa_faixa_dimensional: 'usa_faixa_dimensional',
    nome: 'nome',
  },
};

function remapFilters(
  table: string,
  filters?: Record<string, unknown>,
): Record<string, unknown> | undefined {
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
  return map ? (map[column] ?? column) : column;
}

function mapRows(table: string, rows: unknown[]): unknown[] {
  if (table === 'tecnicas_gravacao') {
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...row,
        id: row.codigo,
        code: row.codigo,
        name: row.nome,
        is_active: row.ativo,
        display_order: row.ordem_exibicao,
      };
    });
  }
  if (table === 'ramo_atividade' || table === 'ramo_atividade_filho') {
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return { ...row, name: row.nome ?? row.name };
    });
  }
  if (table === 'tabela_preco_gravacao_oficial') {
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...row,
        table_code: row.codigo_tabela,
        // FIX (adversarial BUG B): inject codigo_curto as table_code_option (not codigo_tabela)
        table_code_option: row.codigo_curto,
        table_fullcode: row.codigo_tabela,
        customization_type_name: row.grupo_tecnica,
        is_active: row.ativo,
        max_colors: row.max_cores,
        setup_price: row.custo_setup,
        handling_price: row.custo_manuseio,
        price_by_color: row.cobra_por_cor,
        price_by_area: row.usa_faixa_dimensional,
        name: row.nome,
      };
    });
  }
  return rows;
}

// ── Metrics ───────────────────────────────────────────────────────────────────────
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
export function getRestNativeMetrics(): Readonly<RestNativeMetrics & { avgMs: number }> {
  return {
    ...metrics,
    avgMs: metrics.success > 0 ? Math.round(metrics.totalMs / metrics.success) : 0,
  };
}
export function resetRestNativeMetrics(): void {
  metrics.success = 0;
  metrics.fail = 0;
  metrics.retried = 0;
  metrics.totalMs = 0;
  metrics.lastError = null;
  metrics.lastErrorAt = null;
}

// ── Retry ─────────────────────────────────────────────────────────────────────
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
const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// ── Concurrency limiter ───────────────────────────────────────────────────────────
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit = 6,
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
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

// ── Types ─────────────────────────────────────────────────────────────────────
const OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER = 999;
type RestError = { message: string };
type RestCountMode = 'estimated' | 'exact' | 'planned';
type RestQueryResult = {
  data: Record<string, unknown>[] | null;
  error: RestError | null;
  count: number | null;
};
type RestQuery = PromiseLike<RestQueryResult> & {
  eq: (column: string, value: unknown) => RestQuery;
  in: (column: string, values: readonly unknown[]) => RestQuery;
  is: (column: string, value: null) => RestQuery;
  gte: (column: string, value: unknown) => RestQuery;
  lte: (column: string, value: unknown) => RestQuery;
  gt: (column: string, value: unknown) => RestQuery;
  lt: (column: string, value: unknown) => RestQuery;
  like: (column: string, value: unknown) => RestQuery;
  ilike: (column: string, value: unknown) => RestQuery;
  neq: (column: string, value: unknown) => RestQuery;
  not: (column: string, operator: string, value: unknown) => RestQuery;
  order: (column: string, options: { ascending: boolean }) => RestQuery;
  range: (from: number, to: number) => RestQuery;
};
type RestNativeClient = {
  from: (table: string) => {
    select: (columns: string, options?: { count?: RestCountMode; head?: boolean }) => RestQuery;
  };
};

// ── Eligibility ───────────────────────────────────────────────────────────────
export function isRestNativeEligible(options: InvokeOptions): boolean {
  if (options.operation !== 'select') return false;
  const resolvedTable = TABLE_ALIASES[options.table] ?? options.table;
  return REST_NATIVE_SAFE_TABLES.has(options.table) || REST_NATIVE_SAFE_TABLES.has(resolvedTable);
}

// ── PostgREST operator parsing ────────────────────────────────────────────────
const POSTGREST_OP_REGEX = /^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|not)\.(.+)$/;
function parsePostgrestString(query: RestQuery, col: string, raw: string): RestQuery {
  const match = POSTGREST_OP_REGEX.exec(raw);
  if (!match) return query.eq(col, raw);
  const [, op, rest] = match;
  switch (op) {
    case 'eq':
      return query.eq(col, rest);
    case 'neq':
      return query.neq(col, rest);
    case 'gt':
      return query.gt(col, rest);
    case 'gte':
      return query.gte(col, rest);
    case 'lt':
      return query.lt(col, rest);
    case 'lte':
      return query.lte(col, rest);
    case 'like':
      return query.like(col, rest);
    case 'ilike':
      return query.ilike(col, rest);
    case 'is':
      return rest === 'null' ? query.is(col, null) : query.eq(col, raw);
    case 'in': {
      const inner = rest.replace(/^\(/, '').replace(/\)$/, '');
      return query.in(
        col,
        inner
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      );
    }
    case 'not': {
      const subDot = rest.indexOf('.');
      if (subDot === -1) return query.not(col, 'eq', rest);
      const subOp = rest.slice(0, subDot);
      const subVal = rest.slice(subDot + 1);
      return query.not(col, subOp, subVal);
    }
    default:
      logger.warn(`[rest-native] Unknown PostgREST op '${op}' for '${col}', treating as eq`);
      return query.eq(col, raw);
  }
}
function applyFilters(query: RestQuery, filters?: Record<string, unknown>): RestQuery {
  if (!filters) return query;
  for (const [col, val] of Object.entries(filters)) {
    if (val === null) {
      query = query.is(col, null);
      continue;
    }
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
    if (typeof val === 'string') {
      query = parsePostgrestString(query, col, val);
      continue;
    }
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
  if (!isRestNativeEligible(options))
    throw new Error(`rest-native: not eligible for table=${options.table} op=${options.operation}`);
  if (filters && Object.values(filters).some((v) => Array.isArray(v) && v.length === 0)) {
    logger.debug(`[rest-native] empty IN() filter on ${tableName} → short-circuit empty`);
    return { records: [], count: 0 };
  }
  const countMode = options.countMode ?? 'none';
  const selectCols = remapSelect(tableName, options.select ?? '*');
  const countOption =
    countMode === 'none'
      ? undefined
      : countMode === 'exact'
        ? 'exact'
        : countMode === 'planned'
          ? 'planned'
          : 'estimated';
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
        `[rest-native] _search ignored on '${tableName}': no SEARCH_COLUMNS entry (term len: ${searchTerm.length}).`,
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
      `[rest-native] PAGINATION WARNING: offset=${options.offset} without limit on table=${tableName}. Capping at ${OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER}.`,
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
        `[rest-native] OK table=${resolvedTable} rows=${result.records.length} count=${result.count} ${elapsed}ms${attempt > 0 ? ` (retry #${attempt})` : ''}`,
      );
      recordBridgeCall({
        bridge: 'external-db-bridge',
        op: 'select',
        target: options.table,
        durationMs: elapsed,
        reqBytes: estimatePayloadBytes(options.filters ?? null),
        respBytes: estimatePayloadBytes(result),
        ok: true,
        requestId: newRequestId(),
      });
      return result;
    } catch (e) {
      const msg = toErrorMessage(e);
      if (attempt < REST_NATIVE_RETRY_COUNT && isRetryableError(msg)) {
        logger.warn(`[rest-native] transient error for ${resolvedTable}, retrying: ${msg}`);
        await sleep(REST_NATIVE_RETRY_DELAY_MS);
        continue;
      }
      metrics.fail++;
      metrics.lastError = msg;
      metrics.lastErrorAt = Date.now();
      recordBridgeCall({
        bridge: 'external-db-bridge',
        op: 'select',
        target: options.table,
        durationMs: Date.now() - t0,
        reqBytes: estimatePayloadBytes(options.filters ?? null),
        respBytes: 0,
        ok: false,
        errorMessage: msg,
        requestId: newRequestId(),
      });
      if (ctx?.bridgeEnabled) {
        logger.debug(
          `[rest-native] error for table=${options.table}, falling back to bridge: ${msg}`,
        );
      } else {
        reportSilentEmpty({
          reason: 'rest_error',
          table: options.table,
          operation: options.operation,
          message: msg,
        });
      }
      return null;
    }
  }
  return null;
}

// ── WRITE support ─────────────────────────────────────────────────────────────
const WRITE_TABLE_ALIASES: Record<string, string> = {
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  // personalization_techniques is a real table — writes go directly, no alias needed
  tecnica_gravacao_variante: 'tabela_preco_gravacao_oficial',
};
const REST_NATIVE_WRITE_TABLES = new Set<string>([
  'products',
  'suppliers',
  'categories',
  'print_area_techniques',
  'personalization_techniques',
  'product_variants',
  'product_tags',
  'product_category_assignments',
  'variant_supplier_sources',
  'supplier_branches',
  'tecnica_gravacao',
  'collections',
  'collection_products',
  'product_groups',
  'product_group_members',
  'product_relationships',
  'product_images',
  'product_videos',
  'product_materials',
  'product_kit_components',
  'component_media', // FIX 2026-06-11: nome real no SSOT (kit_component_media nunca existiu)
  'kit_component_print_areas',
  'tecnica_gravacao_variante',
  'tabela_preco_gravacao_oficial',
  'tabela_preco_gravacao_oficial_faixa',
  'tecnicas_gravacao',
  'tags',
]);
const REST_WRITE_OPS = new Set<string>(['insert', 'update', 'delete', 'upsert', 'batch_insert']);
export function isRestNativeWriteEligible(options: InvokeOptions): boolean {
  return REST_WRITE_OPS.has(options.operation) && REST_NATIVE_WRITE_TABLES.has(options.table);
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
  eq: (column: string, value: unknown) => RestWriteBuilder;
  in: (column: string, values: readonly unknown[]) => RestWriteBuilder;
  is: (column: string, value: null) => RestWriteBuilder;
  select: (columns?: string) => RestWriteBuilder;
};
type RestWriteClient = {
  from: (table: string) => {
    insert: (values: unknown) => RestWriteBuilder;
    update: (values: unknown) => RestWriteBuilder;
    delete: () => RestWriteBuilder;
    upsert: (values: unknown, opts?: { onConflict?: string }) => RestWriteBuilder;
  };
};
export async function executeRestNativeWrite<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  if (!isRestNativeWriteEligible(options))
    throw new Error(
      `rest-native: not write-eligible for table=${options.table} op=${options.operation}`,
    );
  const table = resolveWriteTable(options.table);
  const hasScope = !!options.id || (!!options.filters && Object.keys(options.filters).length > 0);
  if ((options.operation === 'update' || options.operation === 'delete') && !hasScope)
    throw new Error(
      `rest-native: ${options.operation} on '${table}' without filter/id forbidden (mass mutation guard).`,
    );
  // Issue #537: fail-loud quando escopo é array vazio (evita 400 PostgREST)
  if (options.filters) {
    const emptyKey = Object.entries(options.filters).find(
      ([, v]) => Array.isArray(v) && (v as unknown[]).length === 0,
    )?.[0];
    if (emptyKey) {
      throw new Error(
        `rest-native: ${options.operation} on '${table}' with empty-array filter '${emptyKey}' — zero rows would be affected; fix the call-site.`,
      );
    }
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
    case 'upsert': {
      const upsertOpts = options.onConflict ? { onConflict: options.onConflict } : undefined;
      builder = tbl.upsert(payloadOf(options.data), upsertOpts).select();
      break;
    }
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
  if (error)
    throw new Error(`rest-native write error (${table}/${options.operation}): ${error.message}`);
  const rows = mapRows(table, data ?? []) as T[];
  return { records: rows, count: rows.length };
}
export async function tryExecuteRestNativeWrite<T>(
  options: InvokeOptions,
): Promise<InvokeResult<T> | null> {
  if (!isRestNativeWriteEligible(options)) return null;
  const t0 = Date.now();
  try {
    const result = await executeRestNativeWrite<T>(options);
    metrics.success++;
    metrics.totalMs += Date.now() - t0;
    logger.debug(
      `[rest-native] WRITE OK ${options.operation} table=${resolveWriteTable(options.table)} rows=${result.records.length} ${Date.now() - t0}ms`,
    );
    return result;
  } catch (e) {
    const msg = toErrorMessage(e);
    metrics.fail++;
    metrics.lastError = msg;
    metrics.lastErrorAt = Date.now();
    logger.warn(
      `[rest-native] WRITE FAIL ${options.operation} table=${resolveWriteTable(options.table)}: ${msg}`,
    );
    throw e;
  }
}

/** Alias for any table/view name accepted by the external DB REST layer. */
export type ExternalTable = string;

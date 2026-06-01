/**
 * Direct PostgREST data access (`supabase.from()`), replacing the external-db
 * bridge framework for all application call sites.
 *
 * Why this module exists
 * ----------------------
 * The former bridge entrypoint already used `supabase.from()` as its fast path (via
 * `external-db/rest-native.ts`), but wrapped every call in a kill-switch lookup,
 * telemetry recording and an edge-function fallback. Committing to PostgREST lets
 * us drop that overhead. The non-trivial translation logic rest-native carried —
 * table aliases, bidirectional PT↔EN column remapping, `_search` resolution and
 * PostgREST-string filter parsing — is reproduced here (copied, not imported, so
 * this module survives the eventual deletion of the bridge framework).
 *
 * The public API deliberately mirrors the invoke family (`dbInvoke`,
 * `dbInvokeSingle`, `dbInvokeDelete`, `dbBatch`) and preserves the
 * `{ records, count }` return shape, so call sites migrate by a near-mechanical
 * rename while keeping their option objects unchanged.
 *
 * Error semantics (honest, no silent success):
 *   - Writes always throw on PostgREST error (callers surface toast.error).
 *   - Reads throw too, EXCEPT a 410/Gone (bridge-deprecation) read is translated
 *     to an empty result — definitive, no retry.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ── Public types (mirror the former bridge contract) ───────────────────────────
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

// ── Table aliases (caller name → real relation) ─────────────────────────────────
const TABLE_ALIASES: Record<string, string> = {
  products: 'v_products_public',
  suppliers: 'v_suppliers_public',
  print_area_techniques: 'v_print_area_techniques_public',
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  personalization_techniques: 'tecnicas_gravacao',
  customization_price_tables: 'tabela_preco_gravacao_oficial',
  tecnica_gravacao_variante: 'tabela_preco_gravacao_oficial',
  v_products_without_videos: 'v_products_without_video',
};

// WRITE targets the BASE table, never a view.
const WRITE_TABLE_ALIASES: Record<string, string> = {
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  personalization_techniques: 'tecnicas_gravacao',
  tecnica_gravacao_variante: 'tabela_preco_gravacao_oficial',
};

// ── Column aliases for PT-named tables (caller EN name → real PT column) ─────────
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
  ramo_atividade: {
    name: 'nome',
    nome: 'nome',
    is_active: 'ativo',
    ativo: 'ativo',
  },
  ramo_atividade_filho: {
    name: 'nome',
    nome: 'nome',
    parent_id: 'ramo_atividade_id',
    ramo_atividade_id: 'ramo_atividade_id',
    is_active: 'ativo',
    ativo: 'ativo',
  },
  tabela_preco_gravacao_oficial: {
    table_code: 'codigo_tabela',
    codigo_tabela: 'codigo_tabela',
    table_code_option: 'codigo_tabela',
    table_fullcode: 'codigo_tabela',
    customization_type_name: 'grupo_tecnica',
    grupo_tecnica: 'grupo_tecnica',
    is_active: 'ativo',
    ativo: 'ativo',
    max_colors: 'max_cores',
    max_cores: 'max_cores',
    setup_price: 'custo_setup',
    custo_setup: 'custo_setup',
    handling_price: 'custo_manuseio',
    custo_manuseio: 'custo_manuseio',
    price_by_color: 'cobra_por_cor',
    cobra_por_cor: 'cobra_por_cor',
    price_by_area: 'usa_faixa_dimensional',
    usa_faixa_dimensional: 'usa_faixa_dimensional',
    name: 'nome',
    nome: 'nome',
  },
};

// ── Search columns (resolved table → column for `_search`) ──────────────────────
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
  ramo_atividade: 'nome',
  ramo_atividade_filho: 'nome',
  tags: 'name',
  variation_types: 'name',
  product_groups: 'description',
  collections: 'name',
  customization_price_tables: 'nome',
};

function resolveSearchColumn(table: string): string | null {
  const resolved = TABLE_ALIASES[table] ?? table;
  return SEARCH_COLUMNS[resolved] ?? SEARCH_COLUMNS[table] ?? null;
}

function normalizeSearchTerm(filters?: Record<string, unknown>): string | undefined {
  if (!filters || !('_search' in filters)) return undefined;
  const raw = filters._search;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

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

function remapData(table: string, data: Record<string, unknown>): Record<string, unknown> {
  const map = COLUMN_ALIASES_BY_TABLE[table];
  if (!map) return data;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[map[k] ?? k] = v;
  return out;
}

function remapSelect(table: string, select: string): string {
  // PT-named tables select '*' then map rows back to EN keys.
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
        table_code_option: row.codigo_tabela,
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

// ── PostgREST builder typing (subset we use) ────────────────────────────────────
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
type RestSelectClient = {
  from(table: string): {
    select(columns: string, options?: { count?: RestCountMode; head?: boolean }): RestQuery;
  };
};

// ── PostgREST-string filter parsing (`'gte.10'`, `'in.(a,b)'`, `'is.null'`, …) ──
const POSTGREST_OP_REGEX = /^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|not)\.(.+)$/;
const POSTGREST_NOT_INNER_OPS = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
]);
function parsePostgrestString(query: RestQuery, col: string, raw: string): RestQuery {
  const match = raw.match(POSTGREST_OP_REGEX);
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
      const dotIdx = rest.indexOf('.');
      if (dotIdx <= 0 || dotIdx === rest.length - 1) {
        logger.warn(`[postgrest] Malformed not.* filter for '${col}': '${raw}'`);
        return query.eq(col, raw);
      }
      const innerOp = rest.slice(0, dotIdx);
      const innerVal = rest.slice(dotIdx + 1);
      if (!POSTGREST_NOT_INNER_OPS.has(innerOp)) {
        logger.warn(
          `[postgrest] Unsupported not.* inner op '${innerOp}' for '${col}', treating as eq`,
        );
        return query.eq(col, raw);
      }
      return query.not(col, innerOp, innerVal);
    }
    default:
      logger.warn(`[postgrest] Unknown PostgREST op '${op}' for '${col}', treating as eq`);
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
      else throw new Error(`postgrest: unsupported filter op '${op}' for column '${col}'`);
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

const OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER = 999;

function isGoneError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('410') || lower.includes('gone');
}

// ── SELECT ──────────────────────────────────────────────────────────────────────
async function executeSelect<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  const tableName = TABLE_ALIASES[options.table] ?? options.table;
  const filters = options.filters ? { ...options.filters } : undefined;
  const searchTerm = normalizeSearchTerm(filters);
  if (filters && '_search' in filters) delete filters._search;

  // Empty IN() can never match → short-circuit without a round-trip.
  if (filters && Object.values(filters).some((v) => Array.isArray(v) && v.length === 0)) {
    logger.debug(`[postgrest] empty IN() filter on ${tableName} → short-circuit empty`);
    return { records: [], count: 0 };
  }

  const countMode = options.countMode ?? 'none';
  const selectCols = remapSelect(tableName, options.select ?? '*');
  const countOption: RestCountMode | undefined =
    countMode === 'none'
      ? undefined
      : countMode === 'exact'
        ? 'exact'
        : countMode === 'planned'
          ? 'planned'
          : 'estimated';

  const client = supabase as unknown as RestSelectClient;
  let query = countOption
    ? client.from(tableName).select(selectCols, { count: countOption, head: false })
    : client.from(tableName).select(selectCols);

  query = applyFilters(query, remapFilters(tableName, filters));

  if (searchTerm) {
    const searchCol = resolveSearchColumn(options.table);
    if (searchCol) query = query.ilike(searchCol, `%${searchTerm}%`);
    else logger.warn(`[postgrest] _search ignored on '${tableName}': no SEARCH_COLUMNS entry.`);
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
      `[postgrest] offset=${options.offset} without limit on ${tableName}. Capping at ${OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER}.`,
    );
    query = query.range(options.offset, options.offset + OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER);
  }

  const { data, error, count } = await query;
  if (error) {
    if (isGoneError(error.message)) {
      const { reportSilentEmpty } = await import('@/lib/external-db/silent-empty-report');
      reportSilentEmpty({
        reason: 'gone_410',
        table: options.table,
        operation: 'select',
        message: error.message,
      });
      logger.warn(
        `[postgrest] read on '${tableName}' returned 410/Gone — returning empty (no retry).`,
      );
      return { records: [], count: 0 };
    }
    throw new Error(`postgrest error (${tableName}): ${error.message}`);
  }
  return {
    records: mapRows(tableName, data ?? []) as T[],
    count: typeof count === 'number' ? count : null,
  };
}

// ── WRITE ─────────────────────────────────────────────────────────────────────
type RestWriteBuilder = PromiseLike<RestQueryResult> & {
  select(columns?: string): RestWriteBuilder;
} & RestQuery;
type RestWriteClient = {
  from(table: string): {
    insert(values: unknown): RestWriteBuilder;
    update(values: unknown): RestWriteBuilder;
    delete(): RestWriteBuilder;
    upsert(values: unknown): RestWriteBuilder;
  };
};

function resolveWriteTable(table: string): string {
  return WRITE_TABLE_ALIASES[table] ?? table;
}

async function executeWrite<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  const table = resolveWriteTable(options.table);
  const hasScope = !!options.id || (!!options.filters && Object.keys(options.filters).length > 0);
  if ((options.operation === 'update' || options.operation === 'delete') && !hasScope) {
    throw new Error(
      `postgrest: ${options.operation} on '${table}' without filter/id is forbidden (mass-mutation guard).`,
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
      throw new Error(`postgrest: unsupported write operation '${options.operation}'`);
  }
  const { data, error } = await builder;
  if (error)
    throw new Error(`postgrest write error (${table}/${options.operation}): ${error.message}`);
  const rows = mapRows(table, data ?? []) as T[];
  return { records: rows, count: rows.length };
}

// ── Public API ──────────────────────────────────────────────────────────────────

/** Direct PostgREST replacement for the former bridge select call. Multiplexes on `operation`. */
export async function dbInvoke<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  if (options.operation === 'select') return executeSelect<T>(options);
  return executeWrite<T>(options);
}

/** Direct PostgREST replacement for the former single-row select helper. Throws if no row. */
export async function dbInvokeSingle<T>(options: InvokeOptions): Promise<T> {
  const result = await dbInvoke<T>(options);
  if (!result.records?.length) throw new Error('Nenhum registro retornado');
  return result.records[0];
}

/** Direct PostgREST replacement for the former delete-by-id helper. */
export async function dbInvokeDelete(table: string, id: string): Promise<void> {
  await executeWrite({ table, operation: 'delete', id });
}

// ── Batch (parallel selects) ────────────────────────────────────────────────────
const BATCH_CONCURRENCY_LIMIT = 6;
async function runWithConcurrency<T>(
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
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

/** Direct PostgREST replacement for `invokeBatchBridge` — runs selects in parallel. */
export async function dbBatch(queries: BatchQuery[]): Promise<BatchResult[]> {
  const settled = await runWithConcurrency(
    queries.map(
      (q) => () =>
        executeSelect<Record<string, unknown>>({
          table: q.table,
          operation: 'select',
          select: q.select,
          filters: q.filters,
          orderBy: q.orderBy,
          limit: q.limit,
          offset: q.offset,
          countMode: 'exact',
        }),
    ),
  );
  return settled.map((r) =>
    r.status === 'fulfilled'
      ? { success: true, data: { records: r.value.records, count: r.value.count } }
      : { success: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) },
  );
}

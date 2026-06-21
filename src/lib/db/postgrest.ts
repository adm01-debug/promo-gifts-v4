/**
 * Direct PostgREST data access (`supabase.from()`), replacing the external-db
 * bridge framework for all application call sites.
 *
 * FIX 2026-06-01 (PR #573): Added COLUMN_MAP for PT-named tables to translate
 * EN filter/orderBy/select names before PostgREST.
 *
 * FIX 2026-06-01 (T20 / PR #576): Added mapRows() to enrich responses from varchar-PK tables.
 *
 * FIX 2026-06-01 (adversarial): 3 bugs found by deep adversarial validation:
 *   1. personalization_techniques alias REMOVED — real table exists in DB with uuid PK
 *   2. mapRows now handles tabela_preco_gravacao_oficial (mirrors rest-native.ts)
 *   3. (rest-native.ts) table_code_option fixed to 'codigo_curto' (was 'codigo_tabela')
 */
// import { supabase } from '@/integrations/supabase/client'; // unused
import { GOLD_READ_ALIASES } from '@/integrations/supabase/gold-relations';
import { untypedFrom } from '@/lib/supabase-untyped';
import { logger } from '@/lib/logger';
import { reportSilentEmpty } from '@/lib/external-db/silent-empty-report';

export type Operation = 'batch_insert' | 'delete' | 'insert' | 'select' | 'update' | 'upsert';

export interface InvokeOptions<T = Record<string, unknown>> {
  table: string;
  operation: Operation;
  data?: T;
  id?: string;
  filters?: Record<string, unknown>;
  select?: string;
  orderBy?: { column: string; ascending?: boolean; nullsFirst?: boolean };
  // Desempate determinístico opcional (ex.: { column: 'id', ascending: true }).
  // Sem ele, um ORDER BY por coluna NÃO-única + paginação OFFSET produz ordem
  // não-determinística entre páginas → produtos duplicados/pulados no scroll.
  secondaryOrderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  countMode?: 'estimated' | 'exact' | 'none' | 'planned';
  /** AbortSignal — when aborted, the underlying HTTP request is cancelled. */
  signal?: AbortSignal;
}

export interface InvokeResult<T> {
  records: T[];
  count: number | null;
}

// Bridge-era aliases: virtual names -> real DB table names. Valem para leitura
// E escrita (as tabelas-fonte nunca existiram no banco).
// IMPORTANT: only include aliases where the source does NOT exist as a real table.
// personalization_techniques was REMOVED (BUG 1): it IS a real table with uuid PK,
// EN column names, and its own RLS. Redirecting to tecnicas_gravacao returned wrong data.
const BRIDGE_ALIASES: Record<string, string> = {
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  customization_price_tables: 'tabela_preco_gravacao_oficial',
  tecnica_gravacao_variante: 'tabela_preco_gravacao_oficial',
  // NOTE: 'personalization_techniques' is intentionally NOT aliased here.
  // It is a real table in the DB (uuid PK, EN columns, authenticated-only RLS).
  // Queries to personalization_techniques go directly to that table.
};

// TABLE_ALIASES (LEITURA): bridge aliases + camada Ouro do Medallion
// (gold-relations.ts), que redireciona tabelas-base para as views públicas:
//   products -> v_products_public (grants por coluna na base quebram select=*)
//   suppliers -> v_suppliers_public (base esconde api_credentials)
// Escritas NÃO usam os aliases Ouro: views públicas não têm grant de DML
// (dbInvokeDelete mira a tabela-base, resolvendo apenas BRIDGE_ALIASES).
const TABLE_ALIASES: Record<string, string> = {
  ...GOLD_READ_ALIASES,
  ...BRIDGE_ALIASES,
};

// COLUMN_MAP: EN caller names -> real PT column names (for bridge-era PT-named tables)
// Re-verificado em 2026-06-11 contra information_schema.columns do SSOT
// doufsxqlfjyuvxuezpln (tecnicas_gravacao: codigo/nome/slug/ativo/ordem_exibicao;
// tabela_preco_gravacao_oficial_faixa: quantidade_*/preco_unitario/ordem/...).
const COLUMN_MAP: Record<string, Record<string, string>> = {
  tabela_preco_gravacao_oficial: {
    // PT passthrough (idempotent)
    ativo: 'ativo',
    codigo_tabela: 'codigo_tabela',
    codigo_curto: 'codigo_curto',
    grupo_tecnica: 'grupo_tecnica',
    max_cores: 'max_cores',
    custo_setup: 'custo_setup',
    custo_manuseio: 'custo_manuseio',
    cobra_por_cor: 'cobra_por_cor',
    usa_faixa_dimensional: 'usa_faixa_dimensional',
    nome: 'nome',
    id: 'id',
    // EN -> PT translations (what callers send)
    is_active: 'ativo',
    active: 'ativo',
    table_code: 'codigo_tabela',
    // table_code_option maps to codigo_curto (the short mnemonic: BMC, FB, FC...)
    // NOT codigo_tabela. Verified: codigo_curto and codigo_tabela have different values.
    table_code_option: 'codigo_curto',
    table_fullcode: 'codigo_tabela',
    customization_type_name: 'grupo_tecnica',
    technique_name: 'grupo_tecnica',
    name: 'nome',
    max_colors: 'max_cores',
    setup_price: 'custo_setup',
    handling_price: 'custo_manuseio',
    price_by_color: 'cobra_por_cor',
    price_by_area: 'usa_faixa_dimensional',
    // Ghost columns from bridge era (no equivalent in this table)
    technique_id: 'id',
    max_area_width_cm: 'id',
    max_area_height_cm: 'id',
    max_area_width: 'id',
    max_area_height: 'id',
  },
  tecnicas_gravacao: {
    // PT passthrough
    ativo: 'ativo',
    codigo: 'codigo',
    nome: 'nome',
    slug: 'slug',
    ordem_exibicao: 'ordem_exibicao',
    // No 'id' column in tecnicas_gravacao; PK is 'codigo' (varchar)
    id: 'codigo',
    // EN -> PT
    is_active: 'ativo',
    active: 'ativo',
    name: 'nome',
    code: 'codigo',
    display_order: 'ordem_exibicao',
  },
};

function remapColumnName(resolvedTable: string, col: string): string {
  return COLUMN_MAP[resolvedTable]?.[col] ?? col;
}

function remapFilters(
  resolvedTable: string,
  filters: Record<string, unknown>,
): Record<string, unknown> {
  const map = COLUMN_MAP[resolvedTable];
  if (!map) return filters;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) {
    out[map[k] ?? k] = v;
  }
  return out;
}

function remapSelect(resolvedTable: string, select: string): string {
  const map = COLUMN_MAP[resolvedTable];
  if (!map || select === '*') return select;
  return select
    .split(',')
    .map((col) => {
      const trimmed = col.trim();
      if (trimmed.includes(':') || trimmed.includes('(')) return col;
      const mapped = map[trimmed];
      // Only alias if the mapped name differs (avoids 'nome:nome' redundancy)
      if (mapped && mapped !== trimmed) return `${mapped}:${trimmed}`;
      return col;
    })
    .join(',');
}

/**
 * Post-processes DB response rows to inject synthetic/alias fields.
 * Mirrors rest-native.ts mapRows() behavior for consistency.
 *
 * tecnicas_gravacao: PK is 'codigo' (varchar). Inject id=codigo so callers
 *   using t.id get the correct string PK ('SERIGRAFIA', 'LASER', etc.).
 *
 * tabela_preco_gravacao_oficial: Inject EN aliases so callers using
 *   bridge-era EN field names (table_code, is_active, max_colors...) get data.
 *   BUG 3 FIX: was missing this case, causing callers via dbInvoke to receive
 *   raw PT field names while callers via the legacy bridge received EN aliases.
 */
function mapRows<T>(resolvedTable: string, rows: T[]): T[] {
  if (resolvedTable === 'tecnicas_gravacao') {
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...row,
        id: row.codigo,
        code: row.codigo,
        name: row.nome,
        is_active: row.ativo,
        display_order: row.ordem_exibicao,
      } as T;
    });
  }
  if (resolvedTable === 'tabela_preco_gravacao_oficial') {
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...row,
        // EN aliases (what bridge-era callers expect)
        table_code: row.codigo_tabela,
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
      } as T;
    });
  }
  return rows;
}

// FIX 2026-06-14 (catalog-search-audit): _search agora aceita MÚLTIPLAS colunas.
// Valor string[] => OR de ILIKE (name OU sku OU supplier_reference); string => 1 coluna (legado, inalterado).
const SEARCH_COLUMNS: Record<string, string[] | string> = {
  v_products_public: ['name', 'sku', 'supplier_reference'],
  products: ['name', 'sku', 'supplier_reference'],
  categories: 'name',
  v_suppliers_public: 'name',
  suppliers: 'name',
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
  // personalization_techniques has native 'name' column (EN, no mapping needed)
  personalization_techniques: 'name',
};

// FIX 2026-06-15 (catalog-search-audit #2): tabelas com search_vector usam FTS via
// .textSearch() — acento-insensível (vetor construído com unaccent), stemming PT-BR,
// multi-palavra AND, frase exacta, OR e negação; muito mais abrangente que ILIKE.
// Prova: 'termica' ILIKE=11 produtos vs FTS=827 (+7418%); 'sustentavel' ILIKE=0 vs FTS=252.
// O termo é normalizado (NFD + strip) antes do FTS para garantir match mesmo com acento.
const FTS_TABLES: Record<string, { column: string; config: string }> = {
  v_products_public: { column: 'search_vector', config: 'portuguese' },
  products: { column: 'search_vector', config: 'portuguese' },
};

/** Strip accents via NFD decomposition (mirrors normalizeProductSearch no cliente). */
function stripAccents(s: string): string {
  // Strip combining diacritical marks (U+0300-U+036F) — mirrors normalizeProductSearch.
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Helper de retry: do not retry 4xx errors (client bugs, not transient).
 * Only 5xx (server errors) justify a retry.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const status = (error as { status?: number })?.status;
  if (typeof status === 'number' && status < 500) return false;
  return true;
}

// FTS_TABLES already defined above handles _search. _name_prefix is a distinct
// meta-filter: prefix ILIKE across name/sku/supplier_reference (no FTS needed).
// Columns are native EN names as they appear in v_products_public.
const NAME_PREFIX_COLUMNS: Record<string, string[]> = {
  v_products_public: ['name', 'sku', 'supplier_reference'],
  products: ['name', 'sku', 'supplier_reference'],
};

// ── WRITE support ─────────────────────────────────────────────────────────────
// Writes target the REAL base table, never the Gold read-views (which expose no
// DML grant). Only BRIDGE_ALIASES apply — mirrors dbInvokeDelete's resolution.

// Whitelist of tables (resolved post-alias) that may be written via dbInvoke.
// Tables NOT listed here (e.g. frontend_telemetry, which uses supabase.from()
// directly) will throw loudly instead of silently falling back to a SELECT.
const POSTGREST_WRITE_TABLES = new Set<string>([
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
  'collections',
  'collection_products',
  'product_groups',
  'product_group_members',
  'product_relationships',
  'product_images',
  'product_videos',
  'product_materials',
  'product_kit_components',
  'component_media',
  'kit_component_print_areas',
  'tabela_preco_gravacao_oficial',
  'tabela_preco_gravacao_oficial_faixa',
  'tecnicas_gravacao',
  'tags',
  // Bridge-alias inputs (resolved to the above via BRIDGE_ALIASES)
  'tecnica_gravacao',
  'tecnica_gravacao_variante',
  'customization_price_tiers',
  'customization_price_tables',
]);

type WriteResult = { data: unknown; error: { message?: string } | null };
type WriteBuilder = PromiseLike<WriteResult> & {
  insert: (values: unknown) => WriteBuilder;
  update: (values: unknown) => WriteBuilder;
  upsert: (values: unknown) => WriteBuilder;
  delete: () => WriteBuilder;
  select: (columns?: string) => WriteBuilder;
  eq: (column: string, value: unknown) => WriteBuilder;
  in: (column: string, values: readonly unknown[]) => WriteBuilder;
  is: (column: string, value: null) => WriteBuilder;
};

function remapWriteData(resolvedTable: string, data: unknown): unknown {
  const map = COLUMN_MAP[resolvedTable];
  const remapRow = (row: Record<string, unknown>): Record<string, unknown> => {
    if (!map) return row;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[map[k] ?? k] = v;
    return out;
  };
  if (Array.isArray(data)) return (data as Record<string, unknown>[]).map(remapRow);
  return remapRow((data ?? {}) as Record<string, unknown>);
}

/**
 * Executes insert/update/upsert/delete/batch_insert via PostgREST.
 *
 * CRITICAL BUGFIX (cadastro-de-produtos audit): dbInvoke historically only ever
 * built `untypedFrom(table).select(...)`, so EVERY caller passing a write
 * `operation` (product create/edit, bulk activate/deactivate, new category, new
 * supplier, técnicas, …) performed a silent no-op read that returned an unrelated
 * row and reported success — no data was ever persisted. This executor issues the
 * real DML, returning the affected row(s) via `.select()` so callers receive a
 * genuine inserted/updated record (e.g. the new product id used for navigation).
 */
async function dbInvokeWrite<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  const table = BRIDGE_ALIASES[options.table] ?? options.table;
  const op = options.operation;

  // Write-eligibility guard: only tables in POSTGREST_WRITE_TABLES may be
  // mutated via dbInvoke. Tables that use supabase.from() directly (e.g.
  // frontend_telemetry) must NOT silently fall through to a no-op SELECT.
  if (!POSTGREST_WRITE_TABLES.has(table) && !POSTGREST_WRITE_TABLES.has(options.table)) {
    throw new Error(
      `[postgrest] ${op} on '${options.table}' is not supported — add it to POSTGREST_WRITE_TABLES if intentional.`,
    );
  }

  // Mass-mutation guard: update/delete MUST be scoped by id or filters.
  const hasScope = !!options.id || (!!options.filters && Object.keys(options.filters).length > 0);
  if ((op === 'update' || op === 'delete') && !hasScope) {
    throw new Error(
      `[postgrest] ${op} on '${table}' without id/filter is forbidden (mass-mutation guard).`,
    );
  }
  // Empty-array filter would silently match zero rows → fail loud (Issue #537 parity).
  if (options.filters) {
    for (const [k, v] of Object.entries(options.filters)) {
      if (Array.isArray(v) && v.length === 0) {
        throw new Error(
          `[postgrest] ${op} on '${table}' with empty-array filter '${k}' would affect zero rows; fix the call site.`,
        );
      }
    }
  }

  const applyScope = (builder: WriteBuilder): WriteBuilder => {
    let scoped = builder;
    if (options.id) scoped = scoped.eq('id', options.id);
    if (options.filters) {
      for (const [key, value] of Object.entries(remapFilters(table, options.filters))) {
        if (Array.isArray(value)) scoped = scoped.in(key, value);
        else if (value === null) scoped = scoped.is(key, null);
        else scoped = scoped.eq(key, value);
      }
    }
    return scoped;
  };

  const base = untypedFrom(table) as unknown as WriteBuilder;
  const payload = remapWriteData(table, options.data);
  let builder: WriteBuilder;
  switch (op) {
    case 'insert':
    case 'batch_insert':
      builder = base.insert(payload).select();
      break;
    case 'upsert':
      builder = base.upsert(payload).select();
      break;
    case 'update':
      builder = applyScope(base.update(payload)).select();
      break;
    case 'delete':
      builder = applyScope(base.delete()).select();
      break;
    default:
      throw new Error(`[postgrest] unsupported write operation '${String(op)}'`);
  }

  const { data, error } = await builder;
  if (error) {
    logger.warn(
      `[postgrest] write error on table='${table}' (original='${options.table}') op='${op}': ${error.message ?? 'unknown'}`,
    );
    throw Object.assign(new Error(error.message ?? 'postgrest write error'), error);
  }
  const records = mapRows<T>(table, (data as T[]) ?? []);
  return { records, count: records.length };
}

export async function dbInvoke<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  // WRITE operations are delegated to the dedicated DML executor. Historically
  // dbInvoke only ever issued SELECTs, so callers passing a write operation
  // (insert/update/upsert/delete/batch_insert) silently performed a no-op read
  // and reported a false success — see dbInvokeWrite for the full bug writeup.
  if (options.operation && options.operation !== 'select') {
    return dbInvokeWrite<T>(options);
  }

  const table = TABLE_ALIASES[options.table] ?? options.table;

  // Extract meta-filters before remapping (they are not real column names)
  const rawFilters = options.filters ? { ...options.filters } : undefined;
  let searchTerm: string | undefined;
  let namePrefixTerm: string | undefined;
  if (rawFilters && '_search' in rawFilters) {
    const raw = rawFilters._search;
    if (typeof raw === 'string' && raw.trim() !== '') searchTerm = raw.trim();
    delete rawFilters._search;
  }
  if (rawFilters && '_name_prefix' in rawFilters) {
    const raw = rawFilters._name_prefix;
    // Prefix ILIKE across name/sku/supplier_reference — never an .eq() on the key.
    // Without this extraction, PostgREST rejects the query (column _name_prefix
    // does not exist → 42703) and returns "0 produtos" silently.
    if (typeof raw === 'string' && raw.trim() !== '') namePrefixTerm = raw.trim();
    delete rawFilters._name_prefix;
  }

  const remappedFilters = rawFilters ? remapFilters(table, rawFilters) : undefined;
  const remappedSelect = options.select ? remapSelect(table, options.select) : '*';
  const remappedOrderCol = options.orderBy
    ? remapColumnName(table, options.orderBy.column)
    : undefined;

  // Empty IN() short-circuit: a filter constrained to an empty array can never
  // match any row. Skip the network round-trip entirely (and avoid PostgREST
  // `col=in.()` edge cases) by returning an empty result immediately.
  if (remappedFilters) {
    for (const value of Object.values(remappedFilters)) {
      if (Array.isArray(value) && value.length === 0) {
        return { records: [], count: 0 };
      }
    }
  }

  const countOpt =
    options.countMode && options.countMode !== 'none' ? options.countMode : undefined;
  let query = countOpt
    ? untypedFrom(table).select(remappedSelect, { count: countOpt, head: false })
    : untypedFrom(table).select(remappedSelect);

  if (searchTerm) {
    const ftsCfg = FTS_TABLES[table] ?? FTS_TABLES[options.table];
    if (ftsCfg) {
      // FTS: normaliza o termo (strip accents) p/ casar com o vetor construído via unaccent().
      // websearch_to_tsquery: suporta AND implícito, "frase exacta", OR, -negação.
      // Fallback gracioso p/ ILIKE se o textSearch falhar (e.g. coluna ainda não existe).
      const normalized = stripAccents(searchTerm);
      if (normalized.length > 0) {
        try {
          query = (
            query as unknown as {
              textSearch: (
                col: string,
                q: string,
                opts?: { type?: string; config?: string },
              ) => typeof query;
            }
          ).textSearch(ftsCfg.column, normalized, {
            type: 'websearch',
            config: ftsCfg.config,
          }) as typeof query;
        } catch {
          // Coluna ainda não existe / Supabase SDK incompatível -> degrada p/ ILIKE multi-coluna.
          const searchCfg = SEARCH_COLUMNS[table] ?? SEARCH_COLUMNS[options.table];
          if (searchCfg) {
            const cols = Array.isArray(searchCfg) ? searchCfg : [searchCfg];
            const safe = normalized.replace(/[,()*%]/g, ' ').trim();
            if (safe.length > 0) {
              if (cols.length > 1) {
                query = query.or(cols.map((c) => `${c}.ilike.*${safe}*`).join(','));
              } else {
                query = query.ilike(cols[0], `%${safe}%`);
              }
            }
          }
        }
      }
    } else {
      // Tabela sem FTS: ILIKE (comportamento anterior inalterado para todas as outras tabelas).
      const searchCfg = SEARCH_COLUMNS[table] ?? SEARCH_COLUMNS[options.table];
      if (searchCfg) {
        const cols = Array.isArray(searchCfg) ? searchCfg : [searchCfg];
        if (cols.length === 1) {
          // Caminho legado: 1 coluna -> ilike parametrizado.
          query = query.ilike(cols[0], `%${searchTerm}%`);
        } else {
          // Multi-coluna: sanitizar metacaracteres do .or()/ilike.
          const safe = searchTerm.replace(/[,()*%]/g, ' ').trim();
          if (safe.length > 0) {
            const orExpr = cols.map((c) => `${c}.ilike.*${safe}*`).join(',');
            query = query.or(orExpr);
          } else {
            query = query.ilike(cols[0], `%${searchTerm}%`);
          }
        }
      } else {
        logger.warn(`[postgrest] _search ignored on '${table}': no search column configured`);
      }
    }
  }

  if (namePrefixTerm) {
    const prefixCols = NAME_PREFIX_COLUMNS[table] ?? NAME_PREFIX_COLUMNS[options.table];
    if (prefixCols && prefixCols.length > 0) {
      const orExpr = prefixCols.map((c) => `${c}.ilike.${namePrefixTerm}*`).join(',');
      query = query.or(orExpr);
    } else {
      logger.warn(`[postgrest] _name_prefix ignored on '${table}': no prefix columns configured`);
    }
  }

  if (remappedFilters) {
    for (const [key, value] of Object.entries(remappedFilters)) {
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else if (value === null) {
        query = query.is(key, null);
      } else if (typeof value === 'object' && value !== null && 'op' in value) {
        const op = (value as unknown as { op: string }).op;
        const val = (value as unknown as { value: unknown }).value;
        if (op === 'lt') query = query.lt(key, val);
        else if (op === 'lte') query = query.lte(key, val);
        else if (op === 'gt') query = query.gt(key, val);
        else if (op === 'gte') query = query.gte(key, val);
        else if (op === 'eq') query = query.eq(key, val);
        else if (op === 'neq') query = query.neq(key, val);
        else {
          logger.warn(
            `[postgrest] operador desconhecido '${op}' para coluna '${key}' -- filtro ignorado`,
          );
        }
      } else {
        query = query.eq(key, value);
      }
    }
  }

  if (options.orderBy && remappedOrderCol) {
    query = query.order(remappedOrderCol, {
      ascending: options.orderBy.ascending ?? true,
      ...(options.orderBy.nullsFirst !== undefined
        ? { nullsFirst: options.orderBy.nullsFirst }
        : {}),
    });
    // Desempate determinístico → estabiliza a paginação OFFSET (sem duplicar/pular linhas).
    if (options.secondaryOrderBy) {
      const secondaryCol = remapColumnName(table, options.secondaryOrderBy.column);
      query = query.order(secondaryCol, {
        ascending: options.secondaryOrderBy.ascending ?? true,
      });
    }
  }
  if (typeof options.limit === 'number') {
    const from = options.offset || 0;
    query = query.range(from, from + options.limit - 1);
  }

  const {
    data,
    error,
    count: dbCount,
  } = await (options.signal
    ? (query as unknown as { abortSignal: (s: AbortSignal) => typeof query }).abortSignal(
        options.signal,
      )
    : query);

  if (error) {
    if (error.message?.includes('410') || error.message?.includes('Gone')) {
      reportSilentEmpty({
        reason: 'gone_410',
        table: options.table,
        operation: options.operation,
        message: error.message,
      });
      logger.warn(`[postgrest] read on '${table}' returned 410/Gone`);
      return { records: [], count: 0 };
    }
    logger.warn(
      `[postgrest] error on table='${table}' (original='${options.table}'): ${error.message}`,
    );
    throw error;
  }

  const rawRecords = (data as T[]) || [];
  const records = mapRows<T>(table, rawRecords);

  return { records, count: typeof dbCount === 'number' ? dbCount : records.length };
}

export async function dbInvokeSingle<T>(options: InvokeOptions): Promise<T | null> {
  const result = await dbInvoke<T>({ ...options, limit: 1 });
  return result.records[0] || null;
}

export async function dbInvokeDelete(options: { table: string; id: string }): Promise<void> {
  // Resolve APENAS bridge aliases: deletes devem mirar a tabela-base real.
  // Os aliases de leitura da camada Ouro (GOLD_READ_ALIASES) apontam para views
  // públicas sem grant de DML — ex.: deletar 'print_area_techniques' via
  // v_print_area_techniques_public falharia com permission denied.
  const table = BRIDGE_ALIASES[options.table] ?? options.table;
  const { error } = await untypedFrom(table).delete().eq('id', options.id);
  if (error) throw error;
}

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
const SEARCH_COLUMNS: Record<string, string | string[]> = {
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

export async function dbInvoke<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  const table = TABLE_ALIASES[options.table] ?? options.table;

  // Extract _search before remapping (it's a meta-filter, not a column name)
  const rawFilters = options.filters ? { ...options.filters } : undefined;
  let searchTerm: string | undefined;
  if (rawFilters && '_search' in rawFilters) {
    const raw = rawFilters._search;
    if (typeof raw === 'string' && raw.trim() !== '') searchTerm = raw.trim();
    delete rawFilters._search;
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
    query = query.order(remappedOrderCol, { ascending: options.orderBy.ascending ?? true });
  }
  if (typeof options.limit === 'number') {
    const from = options.offset || 0;
    query = query.range(from, from + options.limit - 1);
  }

  const { data, error, count: dbCount } = await query;

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

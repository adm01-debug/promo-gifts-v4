/**
 * Direct PostgREST data access (`supabase.from()`), replacing the external-db
 * bridge framework for all application call sites.
 *
 * FIX 2026-06-01: Added COLUMN_MAP for PT-named tables (tabela_preco_gravacao_oficial,
 * tecnicas_gravacao) to translate EN filter/orderBy/select names before PostgREST.
 * Root cause: postgrest.ts resolved TABLE_ALIASES (EN->PT table names) but did NOT
 * remap column names, causing HTTP 400 on every query with EN column names.
 */
import { supabase } from '@/integrations/supabase/client';
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

const TABLE_ALIASES: Record<string, string> = {
  products: 'v_products_public',
  suppliers: 'v_suppliers_public',
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  personalization_techniques: 'tecnicas_gravacao',
  customization_price_tables: 'tabela_preco_gravacao_oficial',
  tecnica_gravacao_variante: 'tabela_preco_gravacao_oficial',
};

// -- Column name mapping: EN caller names -> real PT column names in DB --------
// Verified against information_schema.columns in doufsxqlfjyuvxuezpln (2026-06-01).
// Each entry: RESOLVED_TABLE_NAME -> { en_caller_name: 'real_pt_column' }
// Both directions included (PT->PT passthrough) so callers using either name work.
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
    // Ghost columns from bridge era: no equivalent in this table.
    // Map to 'id' so PostgREST doesn't 400 (returns null values, callers handle gracefully).
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
    // No 'id' column in tecnicas_gravacao; use codigo as PK
    id: 'codigo',
    // EN -> PT
    is_active: 'ativo',
    active: 'ativo',
    name: 'nome',
    code: 'codigo',
    display_order: 'ordem_exibicao',
  },
};

/**
 * Returns the real DB column name for a given table (after alias resolution).
 * Falls back to the original name if no mapping exists.
 */
function remapColumnName(resolvedTable: string, col: string): string {
  return COLUMN_MAP[resolvedTable]?.[col] ?? col;
}

/**
 * Remaps all keys in a filters object to real PT column names.
 */
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

/**
 * Remaps a select string (comma-separated column list) to real PT column names.
 * Passes through '*' unchanged.
 * Returns alias syntax so callers still receive EN names in response objects:
 *   'customization_type_name' -> 'grupo_tecnica:customization_type_name'
 */
function remapSelect(resolvedTable: string, select: string): string {
  const map = COLUMN_MAP[resolvedTable];
  if (!map || select === '*') return select;
  return select
    .split(',')
    .map((col) => {
      const trimmed = col.trim();
      if (trimmed.includes(':') || trimmed.includes('(')) return col;
      const mapped = map[trimmed];
      if (mapped && mapped !== trimmed) {
        return `${mapped}:${trimmed}`;
      }
      return col;
    })
    .join(',');
}

/**
 * Helper de retry para useQuery: nao retentar erros 4xx (erros do cliente).
 * 400 Bad Request nao vai resolver entre tentativas -- e bug no codigo.
 * Apenas 5xx (erros do servidor) justificam retry.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const status = (error as { status?: number })?.status;
  if (typeof status === 'number' && status < 500) return false;
  return true;
}

export async function dbInvoke<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  const table = TABLE_ALIASES[options.table] ?? options.table;

  const remappedFilters = options.filters ? remapFilters(table, options.filters) : undefined;
  const remappedSelect = options.select ? remapSelect(table, options.select) : '*';
  const remappedOrderCol = options.orderBy
    ? remapColumnName(table, options.orderBy.column)
    : undefined;

  let query = supabase.from(table).select(remappedSelect);

  if (remappedFilters) {
    for (const [key, value] of Object.entries(remappedFilters)) {
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else if (value === null) {
        query = query.is(key, null);
      } else if (typeof value === 'object' && value !== null && 'op' in value) {
        const op = (value as { op: string }).op;
        const val = (value as { value: unknown }).value;
        if (op === 'lt')       query = query.lt(key, val);
        else if (op === 'lte') query = query.lte(key, val);
        else if (op === 'gt')  query = query.gt(key, val);
        else if (op === 'gte') query = query.gte(key, val);
        else if (op === 'eq')  query = query.eq(key, val);
        else if (op === 'neq') query = query.neq(key, val);
        else {
          logger.warn(`[postgrest] operador desconhecido '${op}' para coluna '${key}' -- filtro ignorado`);
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

  const { data, error } = await query;

  if (error) {
    if (error.message?.includes('410') || error.message?.includes('Gone')) {
      reportSilentEmpty({ reason: 'gone_410', table: options.table, operation: options.operation, message: error.message });
      logger.warn(`[postgrest] read on '${table}' returned 410/Gone`);
      return { records: [], count: 0 };
    }
    logger.warn(`[postgrest] error on table='${table}' (original='${options.table}'): ${error.message}`);
    throw error;
  }

  return { records: (data as T[]) || [], count: (data as T[])?.length || 0 };
}

export async function dbInvokeSingle<T>(options: InvokeOptions): Promise<T | null> {
  const result = await dbInvoke<T>({ ...options, limit: 1 });
  return result.records[0] || null;
}

export async function dbInvokeDelete(options: { table: string; id: string }): Promise<void> {
  const { error } = await supabase.from(options.table).delete().eq('id', options.id);
  if (error) throw error;
}

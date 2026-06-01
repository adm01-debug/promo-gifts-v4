/**
 * Direct PostgREST data access (`supabase.from()`), replacing the external-db
 * bridge framework for all application call sites.
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

export async function dbInvoke<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  const table = TABLE_ALIASES[options.table] ?? options.table;
  let query = supabase.from(table).select(options.select || '*');

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (Array.isArray(value)) query = query.in(key, value);
      else if (value === null) query = query.is(key, null);
      else if (typeof value === 'object' && value !== null && 'op' in value) {
        const op = (value as { op: string }).op;
        const val = (value as { value: unknown }).value;
        if (op === 'gte') query = query.gte(key, val);
        else if (op === 'lte') query = query.lte(key, val);
        else if (op === 'eq') query = query.eq(key, val);
      } else {
        query = query.eq(key, value);
      }
    }
  }

  if (options.orderBy) {
    query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
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


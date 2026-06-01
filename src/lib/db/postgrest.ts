import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { reportSilentEmpty } from '@/lib/external-db/silent-empty-report';

export async function dbInvoke<T>(options: {
  table: string;
  operation: 'select';
  select?: string;
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}): Promise<{ records: T[]; count: number }> {
  // Using direct PostgREST as bridge is deprecated
  let query = supabase.from(options.table).select(options.select || '*');

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (Array.isArray(value)) query = query.in(key, value);
      else if (value === null) query = query.is(key, null);
      else if (typeof value === 'object' && value !== null && 'op' in value) {
        // Simplified filter handling for PoC
        const op = (value as { op: string }).op;
        const val = (value as { value: unknown }).value;
        if (op === 'gte') query = query.gte(key, val);
        else if (op === 'lte') query = query.lte(key, val);
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
    const isGone = error.message?.includes('410') || error.message?.includes('Gone');
    if (isGone) {
      reportSilentEmpty({ reason: 'gone_410', table: options.table, operation: 'select', message: error.message });
      logger.warn(`Bridge deprecated (410) for ${options.table}`);
      return { records: [], count: 0 };
    }
    throw error;
  }

  return { records: (data as T[]) || [], count: (data as T[]).length };
}

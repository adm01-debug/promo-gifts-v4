/**
 * REST-native fallback for external-db-bridge SELECT operations.
 *
 * When the kill-switch `edge_external_db_bridge` is OFF, eligible read-only
 * queries are rerouted to local Postgres via supabase.from(...).select(...).
 *
 * Eligibility: SELECT only, table in REST_NATIVE_SAFE_TABLES, no _search filter.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { InvokeOptions, InvokeResult } from './bridge';

const REST_NATIVE_SAFE_TABLES = new Set<string>([
  'products',
  'product_variants',
  'product_images',
  'suppliers',
  'color_variations',
  'color_groups',
]);

/**
 * BUG-NEW-02 FIX: When offset is provided without limit, this conservative
 * upper bound prevents unbounded queries while making the behaviour visible
 * in logs (via logger.warn below). Callers should always specify `limit`
 * alongside `offset` for predictable pagination.
 */
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

export function isRestNativeEligible(options: InvokeOptions): boolean {
  if (options.operation !== 'select') return false;
  if (!REST_NATIVE_SAFE_TABLES.has(options.table)) return false;
  if (options.filters && '_search' in options.filters) return false;
  return true;
}

/**
 * PostgREST operator prefixes that callers may pass as string values.
 * The bridge accepted these natively; REST-native must parse them into
 * proper Supabase client method calls.
 *
 * Example: { stock_quantity: 'lt.50' } must become .lt('stock_quantity', 50)
 *          { id: 'in.(uuid1,uuid2)' }  must become .in('id', ['uuid1','uuid2'])
 */
const POSTGREST_OP_REGEX = /^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|not)\.(.+)$/;

function parsePostgrestString(
  query: RestQuery,
  col: string,
  raw: string,
): RestQuery {
  const match = raw.match(POSTGREST_OP_REGEX);
  if (!match) {
    // No operator prefix — treat as literal equality (e.g. 'true', 'some-uuid')
    return query.eq(col, raw);
  }

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
      if (rest === 'null') return query.is(col, null);
      return query.eq(col, raw); // fallback for is.true etc
    case 'in': {
      // Parse 'in.(val1,val2,val3)' → ['val1','val2','val3']
      const inner = rest.replace(/^\(/, '').replace(/\)$/, '');
      const values = inner.split(',').map((v) => v.trim()).filter(Boolean);
      return query.in(col, values);
    }
    case 'not':
      // 'not.eq.value' or 'not.is.null' etc — use Supabase .not()
      return query.not(col, op, rest);
    default:
      // Unknown operator — log and treat as literal eq
      logger.warn(`[rest-native] Unknown PostgREST operator '${op}' for column '${col}', treating as eq`);
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
    // BUG-REST-01 FIX: String values may contain PostgREST operator prefixes
    // from bridge-era callers (e.g. 'lt.50', 'gte.2026-...', 'in.(uuid,...)').
    // Parse them into proper Supabase client method calls instead of blindly
    // passing to .eq() which produces invalid syntax like 'column=eq.lt.50'.
    if (typeof val === 'string') {
      query = parsePostgrestString(query, col, val);
      continue;
    }
    query = query.eq(col, val);
  }
  return query;
}

export async function executeRestNativeSelect<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  if (!isRestNativeEligible(options)) {
    throw new Error(`rest-native: not eligible for table=${options.table} op=${options.operation}`);
  }

  const countMode = options.countMode ?? 'none';
  const selectCols = options.select ?? '*';
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
    ? client.from(options.table).select(selectCols, { count: countOption, head: false })
    : client.from(options.table).select(selectCols);

  query = applyFilters(query, options.filters);

  if (options.orderBy) {
    query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
  }

  if (typeof options.limit === 'number') {
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + options.limit - 1);
  } else if (typeof options.offset === 'number' && options.offset > 0) {
    // BUG-NEW-02 FIX: previously this branch was silent. Now we warn so the
    // pattern is visible in logs. The upper bound is intentionally conservative
    // (999 rows) — callers should always specify limit alongside offset.
    logger.warn(
      `[rest-native] PAGINATION WARNING: offset=${options.offset} without limit on table=${options.table}. ` +
        `Capping at ${OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER} rows. ` +
        'Please specify limit for predictable behavior.',
    );
    query = query.range(options.offset, options.offset + OFFSET_WITHOUT_LIMIT_FALLBACK_UPPER);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`rest-native error: ${error.message}`);

  return {
    records: (data ?? []) as T[],
    count: typeof count === 'number' ? count : null,
  };
}

export async function tryExecuteRestNative<T>(
  options: InvokeOptions,
): Promise<InvokeResult<T> | null> {
  if (!isRestNativeEligible(options)) return null;
  try {
    const result = await executeRestNativeSelect<T>(options);
    logger.debug(
      `[rest-native] OK table=${options.table} rows=${result.records.length} count=${result.count}`,
    );
    return result;
  } catch (e) {
    logger.warn(
      `[rest-native] failed for table=${options.table}, falling back to bridge: ${(e as Error).message}`,
    );
    return null;
  }
}

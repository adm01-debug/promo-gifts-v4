/**
 * REST-native fallback for external-db-bridge SELECT operations.
 *
 * When the kill-switch `edge_external_db_bridge` is OFF (in public.system_kill_switches),
 * eligible read-only queries are transparently rerouted to the local Postgres via
 * `supabase.from(...).select(...)` instead of hitting the deprecated edge function.
 *
 * Eligibility:
 *   - Operation must be SELECT (no writes via REST fallback)
 *   - Table must be on REST_NATIVE_SAFE_TABLES whitelist
 *   - No `_search` virtual filter (bridge-only feature)
 *
 * Inelegible queries fall back to bridge automatically.
 *
 * IMPORTANT: This DOES NOT replace the bridge — it complements it. The bridge
 * remains the primary path while the kill-switch is ON.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { InvokeOptions, InvokeResult } from './bridge';

/**
 * Whitelist of tables safe for REST-native routing.
 * Confirmed to exist locally with sufficient data (see migration audit 2026-05-25).
 */
const REST_NATIVE_SAFE_TABLES = new Set<string>([
  'products',
  'product_variants',
  'product_images',
  'suppliers',
  'color_variations',
  'color_groups',
]);

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
  order(column: string, options: { ascending: boolean }): RestQuery;
  range(from: number, to: number): RestQuery;
};

type RestNativeClient = {
  from(table: string): {
    select(columns: string, options?: { count?: RestCountMode; head?: boolean }): RestQuery;
  };
};

/**
 * Check if an InvokeOptions is eligible for REST-native routing.
 * Conservative: any unknown construct → false.
 */
export function isRestNativeEligible(options: InvokeOptions): boolean {
  if (options.operation !== 'select') return false;
  if (!REST_NATIVE_SAFE_TABLES.has(options.table)) return false;

  // The bridge supports a magical `_search` filter that does ILIKE across columns.
  // We don't replicate this in REST-native — falls back to bridge.
  if (options.filters && '_search' in options.filters) return false;

  return true;
}

/**
 * Map filters object to PostgREST query builder calls.
 *
 * Supported shapes:
 *   { col: value }         → .eq(col, value)
 *   { col: array }         → .in(col, array)
 *   { col: null }          → .is(col, null)
 *   { col: { op: 'gte', value: X } } → .gte(col, X)  (future extensibility)
 */
function applyFilters(query: RestQuery, filters?: Record<string, unknown>): RestQuery {
  if (!filters) return query;

  for (const [col, val] of Object.entries(filters)) {
    if (val === null) {
      query = query.is(col, null);
      continue;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        // Empty array → ensure no rows match (PostgREST `in` with empty fails)
        query = query.in(col, ['__no_match__']);
      } else {
        query = query.in(col, val);
      }
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
      else {
        // Unknown op shape — throw to force fallback
        throw new Error(`rest-native: unsupported filter op '${op}' for column '${col}'`);
      }
      continue;
    }
    // Primitive (string, number, boolean) → eq
    query = query.eq(col, val);
  }
  return query;
}

/**
 * Execute a SELECT via REST nativo (PostgREST). Returns the same shape as invokeExternalDb.
 *
 * @throws if the table is not whitelisted or operation is not select
 * @throws on REST/PostgREST errors (caller should fall back to bridge)
 */
export async function executeRestNativeSelect<T>(
  options: InvokeOptions,
): Promise<InvokeResult<T>> {
  if (!isRestNativeEligible(options)) {
    throw new Error(`rest-native: not eligible for table=${options.table} op=${options.operation}`);
  }

  const countMode = options.countMode ?? 'none';
  const selectCols = options.select ?? '*';
  const countOption =
    countMode === 'none' ? undefined :
    countMode === 'exact' ? 'exact' :
    countMode === 'planned' ? 'planned' :
    'estimated';

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
    // PostgREST `range` is INCLUSIVE on both ends
    query = query.range(offset, offset + options.limit - 1);
  } else if (typeof options.offset === 'number' && options.offset > 0) {
    // Offset without limit — emulate with range to a sane upper bound
    query = query.range(options.offset, options.offset + 999);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`rest-native error: ${error.message}`);
  }

  return {
    records: (data ?? []) as T[],
    count: typeof count === 'number' ? count : null,
  };
}

/**
 * Smart entry point: if eligible, route to REST nativo; else throw to caller for bridge fallback.
 * Best used inside a try/catch in invokeExternalDb.
 */
export async function tryExecuteRestNative<T>(
  options: InvokeOptions,
): Promise<InvokeResult<T> | null> {
  if (!isRestNativeEligible(options)) return null;
  try {
    const result = await executeRestNativeSelect<T>(options);
    logger.debug(`[rest-native] OK table=${options.table} rows=${result.records.length} count=${result.count}`);
    return result;
  } catch (e) {
    logger.warn(`[rest-native] failed for table=${options.table}, falling back to bridge: ${(e as Error).message}`);
    return null;
  }
}

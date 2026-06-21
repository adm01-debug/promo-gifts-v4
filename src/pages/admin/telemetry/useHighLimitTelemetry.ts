import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Série temporal de telemetria SOMENTE para listings com `limit > 50`,
 * que é o domínio do `resolveProductsSelect`. Suporta filtros por:
 *   - operation       (select / insert / rpc / update / delete / all)
 *   - range presets   (24h / 7d / 30d / custom)
 *   - error_kind      (timeout / postgrest_error / validation / network /
 *                     rate_limit / auth / unknown / all)
 *
 * SSOT: lê apenas `query_telemetry`. As linhas de severity='ok' não são
 * persistidas pelo bridge, então a "taxa de erro" é calculada como
 * `errors / (errors + slow + very_slow)` dentro da janela.
 */

export type RangePreset = '7d' | '24h' | '30d' | 'custom';
export type OperationFilter = 'all' | 'delete' | 'insert' | 'rpc' | 'select' | 'update';
export type ErrorKindFilter =
  | 'all'
  | 'auth'
  | 'network'
  | 'postgrest_error'
  | 'rate_limit'
  | 'timeout'
  | 'unknown'
  | 'validation';

export interface HighLimitFiltersState {
  operation: OperationFilter;
  range: RangePreset;
  errorKind: ErrorKindFilter;
  customFromIso?: string;
  customToIso?: string;
}

interface TelemetryRow {
  duration_ms: number;
  severity: string;
  record_count: number | null;
  created_at: string;
  operation: string;
  error_kind: string | null;
}

export interface BucketPoint {
  bucketStartIso: string;
  // latência (ignora errors)
  p50: number;
  p95: number;
  p99: number;
  // erros agrupados por kind
  errorsByKind: Record<string, number>;
  errorsTotal: number;
  // volume
  samples: number;
  recordsTotal: number;
  recordsAvg: number;
}

export interface HighLimitTimeseries {
  fromIso: string;
  toIso: string;
  bucketMs: number;
  points: BucketPoint[];
  totals: {
    samples: number;
    errors: number;
    errorRate: number;
    avgMs: number;
    p95Ms: number;
    avgRecords: number;
  };
}

const RANGE_MS: Record<Exclude<RangePreset, 'custom'>, number> = {
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
};

/** Bucket size auto: ~50–80 pontos no eixo X. */
function pickBucketMs(spanMs: number): number {
  if (spanMs <= 6 * 3_600_000) return 5 * 60_000; // 5min
  if (spanMs <= 36 * 3_600_000) return 30 * 60_000; // 30min
  if (spanMs <= 7 * 86_400_000) return 3 * 3_600_000; // 3h
  return 12 * 3_600_000; // 12h
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx];
}

function resolveRange(filters: HighLimitFiltersState): { fromIso: string; toIso: string } {
  const now = Date.now();
  if (filters.range === 'custom' && filters.customFromIso && filters.customToIso) {
    return { fromIso: filters.customFromIso, toIso: filters.customToIso };
  }
  const span =
    RANGE_MS[
      (filters.range === 'custom' ? '24h' : filters.range) as Exclude<RangePreset, 'custom'>
    ];
  return { fromIso: new Date(now - span).toISOString(), toIso: new Date(now).toISOString() };
}

async function fetchRows(
  filters: HighLimitFiltersState,
  fromIso: string,
  toIso: string,
): Promise<TelemetryRow[]> {
  let q = supabase
    .from('query_telemetry')
    .select('duration_ms, severity, record_count, created_at, operation, error_kind')
    .gt('query_limit', 50)
    .gte('created_at', fromIso)
    .lt('created_at', toIso)
    .order('created_at', { ascending: true })
    .limit(10_000);

  if (filters.operation !== 'all') q = q.eq('operation', filters.operation);
  if (filters.errorKind !== 'all') q = q.eq('error_kind', filters.errorKind);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TelemetryRow[];
}

function bucketize(
  rows: TelemetryRow[],
  fromMs: number,
  toMs: number,
  bucketMs: number,
): BucketPoint[] {
  const buckets = new Map<number, TelemetryRow[]>();
  for (let t = fromMs; t < toMs; t += bucketMs) buckets.set(t, []);
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    const key = Math.floor((t - fromMs) / bucketMs) * bucketMs + fromMs;
    const arr = buckets.get(key);
    if (arr) arr.push(r);
  }

  const out: BucketPoint[] = [];
  for (const [start, items] of buckets) {
    const errors = items.filter((i) => i.severity === 'error');
    const okish = items.filter((i) => i.severity !== 'error');
    const durations = okish.map((i) => i.duration_ms).sort((a, b) => a - b);
    const errorsByKind: Record<string, number> = {};
    for (const e of errors) {
      const kind = e.error_kind ?? 'unknown';
      errorsByKind[kind] = (errorsByKind[kind] ?? 0) + 1;
    }
    const recordsTotal = okish.reduce((acc, i) => acc + (i.record_count ?? 0), 0);
    out.push({
      bucketStartIso: new Date(start).toISOString(),
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      p99: percentile(durations, 0.99),
      errorsByKind,
      errorsTotal: errors.length,
      samples: items.length,
      recordsTotal,
      recordsAvg: okish.length > 0 ? Math.round(recordsTotal / okish.length) : 0,
    });
  }
  return out.sort((a, b) => a.bucketStartIso.localeCompare(b.bucketStartIso));
}

function summarize(rows: TelemetryRow[]) {
  const samples = rows.length;
  const errors = rows.filter((r) => r.severity === 'error').length;
  const okish = rows.filter((r) => r.severity !== 'error');
  const durations = okish.map((r) => r.duration_ms).sort((a, b) => a - b);
  const sumMs = durations.reduce((a, v) => a + v, 0);
  const records = okish.map((r) => r.record_count ?? 0).filter((n) => n > 0);
  const sumR = records.reduce((a, v) => a + v, 0);
  return {
    samples,
    errors,
    errorRate: samples > 0 ? errors / samples : 0,
    avgMs: durations.length > 0 ? Math.round(sumMs / durations.length) : 0,
    p95Ms: percentile(durations, 0.95),
    avgRecords: records.length > 0 ? Math.round(sumR / records.length) : 0,
  };
}

export function useHighLimitTelemetry(filters: HighLimitFiltersState) {
  const query = useQuery({
    queryKey: [
      'admin.telemetry.highLimit',
      filters.operation,
      filters.range,
      filters.errorKind,
      filters.customFromIso,
      filters.customToIso,
    ],
    queryFn: async (): Promise<HighLimitTimeseries> => {
      const { fromIso, toIso } = resolveRange(filters);
      const fromMs = new Date(fromIso).getTime();
      const toMs = new Date(toIso).getTime();
      const bucketMs = pickBucketMs(Math.max(1, toMs - fromMs));
      const rows = await fetchRows(filters, fromIso, toIso);
      const points = bucketize(rows, fromMs, toMs, bucketMs);
      return { fromIso, toIso, bucketMs, points, totals: summarize(rows) };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
  };
}

export const ERROR_KIND_LABEL: Record<ErrorKindFilter, string> = {
  all: 'Todos os tipos',
  timeout: 'Timeout',
  postgrest_error: 'PostgREST',
  validation: 'Validação',
  network: 'Rede',
  rate_limit: 'Rate limit',
  auth: 'Auth',
  unknown: 'Desconhecido',
};

export const OPERATION_LABEL: Record<OperationFilter, string> = {
  all: 'Todas operações',
  select: 'select',
  insert: 'insert',
  update: 'update',
  delete: 'delete',
  rpc: 'rpc',
};

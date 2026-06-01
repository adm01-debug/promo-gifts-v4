import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Comparativo "antes vs depois" do `resolveProductsSelect` em listings de
 * `products` com limit > 50.
 *
 * Como `query_telemetry` não persiste o `select-decision mode`, a partição
 * é feita por **data de corte** (deploy do resolveProductsSelect). Tudo
 * registrado ANTES do corte = baseline; tudo registrado DEPOIS = pós-deploy.
 *
 * Métricas (todas calculadas por janela):
 *  - Latência:        p50, p95, p99, média (ms)
 *  - CPU estimado:    proxy = duration_ms (sem record_count)
 *                     ou (duration_ms / record_count * 1000) µs/registro
 *  - Taxa de erro:    queries com severity='error' / total
 *  - Volume:          média de record_count, total de queries
 *
 * SSOT: lê apenas `query_telemetry` (severity != 'ok' por design da tabela
 *       — a cauda lenta é exatamente o que queremos comparar).
 */

export type ComparisonWindow = '24h' | '7d' | '30d';

export interface ResolveProductsSelectMetrics {
  samples: number;
  errors: number;
  errorRate: number; // 0..1
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgRecords: number;
  /** µs por registro retornado — proxy razoável para "CPU por linha". */
  cpuPerRecordUs: number;
}

export interface ResolveProductsSelectComparison {
  cutoverIso: string;
  windowFromIso: string;
  windowToIso: string;
  before: ResolveProductsSelectMetrics;
  after: ResolveProductsSelectMetrics;
  /** Diferença relativa após - antes (positivo = piora em latência/erro, negativo = melhora). */
  deltaPct: {
    avgMs: number;
    p95Ms: number;
    p99Ms: number;
    errorRate: number;
    cpuPerRecordUs: number;
  };
}

interface TelemetryRow {
  duration_ms: number;
  severity: string;
  record_count: number | null;
  created_at: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx];
}

function summarize(rows: TelemetryRow[]): ResolveProductsSelectMetrics {
  if (rows.length === 0) {
    return {
      samples: 0,
      errors: 0,
      errorRate: 0,
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      avgRecords: 0,
      cpuPerRecordUs: 0,
    };
  }
  const errors = rows.filter((r) => r.severity === 'error').length;
  // Para latência, descartamos linhas de erro (duração não é comparável).
  const okRows = rows.filter((r) => r.severity !== 'error');
  const durations = okRows.map((r) => r.duration_ms).sort((a, b) => a - b);
  const sumMs = durations.reduce((a, v) => a + v, 0);
  const records = okRows.map((r) => r.record_count ?? 0).filter((n) => n > 0);
  const sumRecords = records.reduce((a, v) => a + v, 0);
  const avgRecords = records.length > 0 ? sumRecords / records.length : 0;
  const avgMs = durations.length > 0 ? sumMs / durations.length : 0;
  const cpuPerRecordUs = avgRecords > 0 ? (avgMs / avgRecords) * 1000 : 0;

  return {
    samples: rows.length,
    errors,
    errorRate: errors / rows.length,
    avgMs: Math.round(avgMs),
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    avgRecords: Math.round(avgRecords),
    cpuPerRecordUs: Math.round(cpuPerRecordUs),
  };
}

async function fetchRows(fromIso: string, toIso: string): Promise<TelemetryRow[]> {
  const { data, error } = await supabase
    .from('query_telemetry')
    .select('duration_ms, severity, record_count, created_at')
    .eq('operation', 'select')
    .eq('table_name', 'products')
    .gt('query_limit', 50)
    .gte('created_at', fromIso)
    .lt('created_at', toIso)
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as TelemetryRow[];
}

function pctDelta(before: number, after: number): number {
  if (before <= 0) return 0;
  return (after - before) / before;
}

const WINDOW_MS: Record<ComparisonWindow, number> = {
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
};

export function useResolveProductsSelectComparison(
  cutoverIso: string,
  windowSize: ComparisonWindow = '7d',
) {
  const query = useQuery({
    queryKey: ['resolve-products-select-comparison', cutoverIso, windowSize],
    queryFn: async (): Promise<ResolveProductsSelectComparison> => {
      const cutover = new Date(cutoverIso).getTime();
      const half = WINDOW_MS[windowSize];
      const fromIso = new Date(cutover - half).toISOString();
      const toIso = new Date(Math.min(Date.now(), cutover + half)).toISOString();

      // Uma única query cobrindo a janela inteira (cutover ± window),
      // depois particionamos no client. Mais barato que 2 round-trips.
      const all = await fetchRows(fromIso, toIso);
      const beforeRows = all.filter((r) => r.created_at < cutoverIso);
      const afterRows = all.filter((r) => r.created_at >= cutoverIso);

      const before = summarize(beforeRows);
      const after = summarize(afterRows);

      return {
        cutoverIso,
        windowFromIso: fromIso,
        windowToIso: toIso,
        before,
        after,
        deltaPct: {
          avgMs: pctDelta(before.avgMs, after.avgMs),
          p95Ms: pctDelta(before.p95Ms, after.p95Ms),
          p99Ms: pctDelta(before.p99Ms, after.p99Ms),
          errorRate: pctDelta(before.errorRate, after.errorRate),
          cpuPerRecordUs: pctDelta(before.cpuPerRecordUs, after.cpuPerRecordUs),
        },
      };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return {
    comparison: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
  };
}

/**
 * Default cutover: 24h atrás. O usuário pode ajustar no card; persistido em
 * localStorage para sobreviver entre sessões.
 */
export const DEFAULT_CUTOVER_LOCALSTORAGE_KEY = 'admin.telemetry.resolveProductsSelect.cutoverIso';

export function getInitialCutover(): string {
  if (typeof window === 'undefined') return new Date(Date.now() - 86_400_000).toISOString();
  const stored = window.localStorage.getItem(DEFAULT_CUTOVER_LOCALSTORAGE_KEY);
  if (stored) {
    const t = Date.parse(stored);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return new Date(Date.now() - 86_400_000).toISOString();
}

export function persistCutover(iso: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEFAULT_CUTOVER_LOCALSTORAGE_KEY, iso);
}

/**
 * useOptimizationMetrics
 * --------------------------------------------------------------
 * Aggregates the new performance signals persisted in `query_telemetry`:
 *   - cache_hit (boolean)   → in-memory LRU hit on external-db-bridge
 *   - retry_count (integer) → retries that the fail-fast logic *avoided*
 *
 * SSOT: lê apenas `query_telemetry`. Cache hits e retry savings são
 * persistidos pelo edge mesmo quando severity='ok' (override em
 * supabase/functions/_shared/external-db-telemetry.ts).
 *
 * Auto-refresh a cada 30s (alinhado com os demais counters do dashboard).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OptimizationMetrics {
  /** Total de respostas servidas a partir do cache LRU nas últimas 24h. */
  cacheHits24h: number;
  /** Total de execuções persistidas nas últimas 24h (denominador do hit-rate). */
  totalSamples24h: number;
  /** Hit rate em % (0-100). Null quando não há amostra suficiente. */
  cacheHitRate: number | null;
  /** Soma de `retry_count` economizado nas últimas 24h pelo fail-fast. */
  retriesSaved24h: number;
}

const QUERY_KEY = ['telemetry', 'optimization-metrics'];

export function useOptimizationMetrics() {
  // BUG-HEAD-GUARD FIX (2026-06-23): 2 HEAD requests com refetchInterval=30s sem guard.
  const { rolesLoaded, isAdmin } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    enabled: rolesLoaded && Boolean(isAdmin),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<OptimizationMetrics> => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [{ count: hits }, { count: total }, { data: retries }] = await Promise.all([
        supabase
          .from('query_telemetry')
          .select('id', { count: 'exact', head: true })
          .eq('cache_hit', true)
          .gte('created_at', since),
        supabase
          .from('query_telemetry')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', since),
        supabase
          .from('query_telemetry')
          .select('retry_count')
          .gt('retry_count', 0)
          .gte('created_at', since)
          .limit(1000),
      ]);

      const cacheHits24h = hits ?? 0;
      const totalSamples24h = total ?? 0;
      const cacheHitRate =
        totalSamples24h > 0 ? Math.round((cacheHits24h / totalSamples24h) * 1000) / 10 : null;
      const retriesSaved24h = (retries ?? []).reduce((sum, r) => sum + (r.retry_count ?? 0), 0);

      return { cacheHits24h, totalSamples24h, cacheHitRate, retriesSaved24h };
    },
  });

  return {
    metrics: data ?? {
      cacheHits24h: 0,
      totalSamples24h: 0,
      cacheHitRate: null,
      retriesSaved24h: 0,
    },
    isLoading,
    refetch,
  };
}

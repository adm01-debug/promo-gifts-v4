/**
 * usePlatformFailureMetrics
 * --------------------------------------------------------------
 * KPIs de falhas de plataforma do `external-db-bridge`:
 *   - Total de chamadas na janela
 *   - Total e taxa de 503
 *   - Total e taxa de cold-starts
 *   - Delta vs janela anterior (early-warning)
 *   - Timestamp do último cold-start
 *
 * Lê via RPC `get_platform_failure_metrics(window_minutes)` que faz
 * agregação eficiente usando o índice parcial `idx_query_telemetry_platform_failures`.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PlatformFailureMetrics {
  windowMinutes: number;
  totalCalls: number;
  total503: number;
  totalColdStarts: number;
  rate503Pct: number;
  rateColdStartPct: number;
  lastColdStartAt: string | null;
  prevWindow503: number;
  delta503: number;
}

const QUERY_KEY = (windowMinutes: number) => ['telemetry', 'platform-failures', windowMinutes];

export function usePlatformFailureMetrics(windowMinutes = 60) {
  const { rolesLoaded, isAdmin } = useAuth();
  return useQuery({
    queryKey: QUERY_KEY(windowMinutes),
    enabled: rolesLoaded && Boolean(isAdmin),
    refetchInterval: 30_000,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<PlatformFailureMetrics> => {
      const { data, error } = await supabase.rpc('get_platform_failure_metrics', {
        window_minutes: windowMinutes,
      });
      if (error) throw error;
      const raw = (data ?? {}) as Record<string, unknown>;
      const num = (k: string) => Number(raw[k] ?? 0);
      return {
        windowMinutes: num('window_minutes') || windowMinutes,
        totalCalls: num('total_calls'),
        total503: num('total_503'),
        totalColdStarts: num('total_cold_starts'),
        rate503Pct: num('rate_503_pct'),
        rateColdStartPct: num('rate_cold_start_pct'),
        lastColdStartAt: (raw.last_cold_start_at as string | null) ?? null,
        prevWindow503: num('prev_window_503'),
        delta503: num('delta_503'),
      };
    },
  });
}

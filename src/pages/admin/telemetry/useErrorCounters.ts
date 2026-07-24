import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Conta erros de telemetria nas últimas 1h e 24h.
 * Independente dos filtros do painel — sempre mostra o panorama atual.
 * Auto-refresh a cada 30s.
 */
export function useErrorCounters() {
  // BUG-HEAD-GUARD FIX (2026-06-23): 2 HEAD requests com refetchInterval=30s sem guard.
  const { rolesLoaded, isAdmin } = useAuth();
  const query = useQuery({
    queryKey: ['query-telemetry-error-counters'],
    queryFn: async () => {
      const now = Date.now();
      const since1h = new Date(now - 3_600_000).toISOString();
      const since24h = new Date(now - 86_400_000).toISOString();

      const [r1h, r24h] = await Promise.all([
        supabase
          .from('query_telemetry')
          .select('*', { count: 'exact', head: true })
          .eq('severity', 'error')
          .gte('created_at', since1h),
        supabase
          .from('query_telemetry')
          .select('*', { count: 'exact', head: true })
          .eq('severity', 'error')
          .gte('created_at', since24h),
      ]);

      if (r1h.error) throw r1h.error;
      if (r24h.error) throw r24h.error;

      return {
        errors1h: r1h.count ?? 0,
        errors24h: r24h.count ?? 0,
      };
    },
    enabled: rolesLoaded && Boolean(isAdmin),
    refetchInterval: 30_000,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    errors1h: query.data?.errors1h ?? 0,
    errors24h: query.data?.errors24h ?? 0,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
  };
}

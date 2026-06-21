/**
 * useRuptureKpiSummary — RPC `fn_ruptura_kpi_summary(_all boolean)` que
 * retorna totalizadores por nível de alerta.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isFeatureEnabled } from '@/lib/feature-flags';
import type { RuptureLevel } from './useRuptureAlerts';

export interface RuptureKpiRow {
  nivel_alerta: RuptureLevel;
  total_variantes: number;
  total_fornecedores: number;
}

export function useRuptureKpiSummary(includeAll = false) {
  const enabled = isFeatureEnabled('useEmaRupture');

  return useQuery({
    queryKey: ['rupture-kpi-summary', includeAll],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RuptureKpiRow[]> => {
      const { data, error } = await (supabase as unknown as {
        rpc: (
          n: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: RuptureKpiRow[] | null; error: Error | null }>;
      }).rpc('fn_ruptura_kpi_summary', { _all: includeAll });
      if (error) throw error;
      return data ?? [];
    },
  });
}

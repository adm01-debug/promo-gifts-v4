/**
 * useRuptureKpiSummary — RPC `fn_ruptura_kpi_summary(boolean)` retornando
 * KPIs agregados por fornecedor (total/risco/cobertura média/lead time médio).
 * Refresh diário no backend; staleTime 5min seguro.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isFeatureEnabled } from '@/lib/feature-flags';

export interface RuptureKpiSummaryRow {
  supplier_id: string | null;
  supplier_name: string | null;
  total_variants: number;
  ruptura_count: number;
  critico_count: number;
  alerta_count: number;
  cobertura_media_dias: number | null;
  lead_time_medio: number | null;
}

export function useRuptureKpiSummary(includeOk = false) {
  const enabled = isFeatureEnabled('useEmaRupture');
  return useQuery({
    queryKey: ['rupture-kpi-summary', includeOk],
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    queryFn: async (): Promise<RuptureKpiSummaryRow[]> => {
      const { data, error } = await (supabase as unknown as {
        rpc: (
          n: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: RuptureKpiSummaryRow[] | null; error: Error | null }>;
      }).rpc('fn_ruptura_kpi_summary', { p_include_ok: includeOk });
      if (error) throw error;
      return data ?? [];
    },
  });
}

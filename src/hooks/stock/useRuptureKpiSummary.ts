/**
 * useRuptureKpiSummary — KPI por nivel_alerta para chips do RupturePanelEma.
 * Chama fn_ema_kpi_by_level() — agregado por nível EMA, não por fornecedor.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RuptureLevel } from './useRuptureAlerts';

export interface RuptureKpiRow {
  nivel_alerta: RuptureLevel;
  prioridade: number;
  total_variantes: number;
  avg_cobertura: number | null;
  min_cobertura: number | null;
}

type AnyRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: Error | null }>;

export function useRuptureKpiSummary(preferredOnly = true) {
  return useQuery({
    queryKey: ['ema-kpi-by-level', preferredOnly] as const,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    queryFn: async (): Promise<RuptureKpiRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as AnyRpc)(
        'fn_ema_kpi_by_level',
        { p_preferred_only: preferredOnly },
      );
      if (error) throw error;
      return (data as RuptureKpiRow[]) ?? [];
    },
  });
}

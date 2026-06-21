/**
 * useSupplierRiskBreakdown — Agrupamento de risco por fornecedor.
 * Chama fn_supplier_risk_breakdown() — Onda 2 / Melhoria 9.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isFeatureEnabled } from '@/lib/feature-flags';

export interface SupplierRiskRow {
  supplier_id: string;
  supplier_name: string;
  total: number;
  ruptura: number;
  critico: number;
  alerta: number;
  atencao: number;
  sem_sinal: number;
  ok: number;
  pct_risco: number;
  score_medio: number;
  gap_total_un: number;
  spikes: number;
  valor_risco_reais: number;
}

type AnyRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: Error | null }>;

export function useSupplierRiskBreakdown(preferredOnly = true) {
  const enabled = isFeatureEnabled('useEmaRupture');
  return useQuery({
    queryKey: ['supplier-risk-breakdown', preferredOnly] as const,
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    queryFn: async (): Promise<SupplierRiskRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as AnyRpc)(
        'fn_supplier_risk_breakdown',
        { p_preferred_only: preferredOnly },
      );
      if (error) throw error;
      return (data as SupplierRiskRow[]) ?? [];
    },
  });
}

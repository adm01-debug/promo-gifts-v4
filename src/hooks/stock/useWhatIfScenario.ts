/**
 * useWhatIfScenario — Simula impacto de adicionar X unidades por SKU.
 * Chama fn_whatif_scenario() — Onda 3 / Melhoria 20.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WhatIfRow {
  nivel_atual: string;
  nivel_simulado: string;
  variantes: number;
  descricao: string;
}

type AnyRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: Error | null }>;

export function useWhatIfScenario(
  deltaUnits: number,
  nivelFilter = 'RUPTURA',
  supplierId?: string | null,
) {
  return useQuery({
    queryKey: ['whatif', deltaUnits, nivelFilter, supplierId ?? null],
    enabled: deltaUnits >= 0,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<WhatIfRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as AnyRpc)(
        'fn_whatif_scenario',
        {
          p_delta_units_per_sku: deltaUnits,
          p_nivel_filter: nivelFilter,
          p_supplier_id: supplierId ?? null,
        },
      );
      if (error) throw error;
      return (data as WhatIfRow[]) ?? [];
    },
  });
}

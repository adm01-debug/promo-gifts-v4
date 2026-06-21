/**
 * useRupturaForecast — Próximas rupturas em 7/15/30 dias.
 * Chama fn_ruptura_forecast_7_15_30() — considera restock programado.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ForecastRow {
  horizonte_dias: number;
  novos_ruptura: number;
  com_restock: number;
  net_ruptura: number;
  score_medio: number;
  gap_total_un: number;
}

type AnyRpc = (fn: string) => Promise<{ data: unknown; error: Error | null }>;

export function useRupturaForecast() {
  return useQuery({
    queryKey: ['ruptura-forecast-7-15-30'],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    queryFn: async (): Promise<ForecastRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as AnyRpc)(
        'fn_ruptura_forecast_7_15_30',
      );
      if (error) throw error;
      return (data as ForecastRow[]) ?? [];
    },
  });
}

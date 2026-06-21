/**
 * useEmaPipelineHealth — RPC `fn_ema_pipeline_health()` retornando status
 * dos componentes do pipeline noturno (crons EMA, mat.view, ETL).
 * Refresh agressivo (60s) — UI de monitoramento admin.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmaPipelineHealthRow {
  componente: string;
  status: 'OK' | 'ATRASO' | 'FALHA' | string;
  ultima_execucao: string | null;
  proxima_execucao: string | null;
  detalhe: string | null;
}

export function useEmaPipelineHealth() {
  return useQuery({
    queryKey: ['ema-pipeline-health'],
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: async (): Promise<EmaPipelineHealthRow[]> => {
      const { data, error } = await (supabase as unknown as {
        rpc: (
          n: string,
        ) => Promise<{ data: EmaPipelineHealthRow[] | null; error: Error | null }>;
      }).rpc('fn_ema_pipeline_health');
      if (error) throw error;
      return data ?? [];
    },
  });
}

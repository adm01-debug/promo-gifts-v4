/**
 * useRegressionGuardrail
 * --------------------------------------------------------------
 * Consulta a RPC `check_telemetry_regression` que compara KPIs da janela
 * atual (últimas 2h) vs baseline (24-48h atrás). Retorna status:
 *   - 'ok'                 → tudo dentro do esperado
 *   - 'warning'            → piora moderada (P95 >25% ou error +2pp)
 *   - 'regression'         → piora crítica (P95 >50%, error +5pp ou very_slow 2x)
 *   - 'insufficient_data'  → amostra < 5 em qualquer janela
 *
 * Auto-refresh a cada 60s. Cache local de 30s para não martelar o BD.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GuardrailStatus = 'ok' | 'warning' | 'regression' | 'insufficient_data' | 'error';

export interface GuardrailWindow {
  samples: number;
  p95_ms: number;
  avg_ms?: number;
  error_rate_pct: number;
  very_slow: number;
}

export interface GuardrailDeltas {
  p95_delta_pct: number;
  error_rate_delta_pp: number;
  very_slow_ratio: number;
}

export interface GuardrailReport {
  status: GuardrailStatus;
  reasons: string[];
  current?: GuardrailWindow;
  baseline?: GuardrailWindow;
  deltas?: GuardrailDeltas;
  checked_at?: string;
  errorMessage?: string;
}

const QUERY_KEY = ['telemetry', 'regression-guardrail'];

export function useRegressionGuardrail() {
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: QUERY_KEY,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<GuardrailReport> => {
      const { data: rpcData, error } = await supabase.rpc('check_telemetry_regression');
      if (error) {
        return {
          status: 'error',
          reasons: [error.message],
          errorMessage: error.message,
        };
      }
      const payload = rpcData as Record<string, unknown>;
      if (payload?.error) {
        return {
          status: 'error',
          reasons: [String(payload.error)],
          errorMessage: String(payload.error),
        };
      }
      return {
        status: (payload?.status as GuardrailStatus) ?? 'insufficient_data',
        reasons: Array.isArray(payload?.reasons) ? (payload.reasons as string[]) : [],
        current: payload?.current as GuardrailWindow | undefined,
        baseline: payload?.baseline as GuardrailWindow | undefined,
        deltas: payload?.deltas as GuardrailDeltas | undefined,
        checked_at: payload?.checked_at as string | undefined,
      };
    },
  });

  return {
    report: data ?? { status: 'insufficient_data' as GuardrailStatus, reasons: [] },
    isLoading,
    refetch,
    lastCheckedAt: dataUpdatedAt,
  };
}

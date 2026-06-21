/**
 * useEmaRiskSummary — Dados para o StockHeroRiskBanner.
 * Chama fn_ema_risk_summary() (contagem por nivel_alerta) e
 * fn_ema_pipeline_health() (frescor do ETL) em paralelo.
 * Sem feature flag — o banner é sempre visível quando dados disponíveis.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmaRiskSummaryRow {
  nivel_alerta: string;
  prioridade: number;
  total: number;
}

export type EtlStatus = 'OK' | 'WARN' | 'ERROR';

export interface EmaEtlHealth {
  /** ISO timestamp do último cálculo EMA (EMA_FRESCOR.valor) */
  freshness: string | null;
  status: EtlStatus;
}

type AnyRpc = (fn: string) => Promise<{ data: unknown; error: Error | null }>;

interface HealthRow {
  componente: string;
  status: string;
  valor: string;
  observacao: string;
}

export interface UseEmaRiskSummaryResult {
  rows: EmaRiskSummaryRow[];
  totalVariants: number;
  etlHealth: EmaEtlHealth;
  isLoading: boolean;
  error: Error | null;
}

export function useEmaRiskSummary(): UseEmaRiskSummaryResult {
  const rpc = supabase.rpc as unknown as AnyRpc;

  const query = useQuery({
    queryKey: ['ema-risk-summary-banner'],
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    queryFn: async () => {
      const [summaryRes, healthRes] = await Promise.all([
        rpc('fn_ema_risk_summary'),
        rpc('fn_ema_pipeline_health'),
      ]);
      if (summaryRes.error) throw summaryRes.error;
      return {
        rows: (summaryRes.data as EmaRiskSummaryRow[]) ?? [],
        health: (healthRes.data as HealthRow[]) ?? [],
      };
    },
  });

  const rows = query.data?.rows ?? [];
  const health = query.data?.health ?? [];
  const totalVariants = rows.reduce((s, r) => s + (r.total ?? 0), 0);

  const frescorComp = health.find((h) => h.componente === 'EMA_FRESCOR');
  const etlHealth: EmaEtlHealth = {
    freshness: frescorComp?.valor ?? null,
    status: frescorComp ? (frescorComp.status as EtlStatus) : 'WARN',
  };

  return {
    rows,
    totalVariants,
    etlHealth,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

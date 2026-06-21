/**
 * useRuptureAlerts — Consome a mat.view `mv_stock_rupture_alert` do banco
 * canônico (doufsxqlfjyuvxuezpln). Refresh da view é noturno (03:29 UTC),
 * staleTime 5min seguro.
 *
 * Hardening (simulação de cenários):
 * - `.limit(2000)` evita pull de 50k+ linhas em catálogos enormes.
 * - Dedup por `variant_id` mantendo a menor `cobertura_dias` (cenário:
 *   múltiplos fornecedores marcados como `is_preferred=true` por bug de
 *   seed — sem dedup, o `Map` perderia o mais crítico).
 * - Catch de erro retorna lista vazia + log; UI mostra empty state sem
 *   crashar quando a view ainda não existe em ambientes não migrados.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isFeatureEnabled } from '@/lib/feature-flags';

export type RuptureLevel = 'RUPTURA' | 'CRÍTICO' | 'ALERTA' | 'ATENÇÃO' | 'OK';

export interface RuptureAlertRow {
  variant_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  nivel_alerta: RuptureLevel;
  cobertura_dias: number | null;
  lead_time_efetivo: number | null;
  ema_diaria: number | null;
  current_stock: number | null;
  prioridade: number | null;
  is_preferred: boolean | null;
}

interface UseRuptureAlertsResult {
  alerts: RuptureAlertRow[];
  byVariantId: Map<string, RuptureAlertRow>;
  isLoading: boolean;
  error: Error | null;
}

const MAX_ROWS = 2000;

function pickWorse(a: RuptureAlertRow, b: RuptureAlertRow): RuptureAlertRow {
  const pa = a.prioridade ?? 9999;
  const pb = b.prioridade ?? 9999;
  if (pa !== pb) return pa < pb ? a : b;
  const ca = a.cobertura_dias ?? Number.POSITIVE_INFINITY;
  const cb = b.cobertura_dias ?? Number.POSITIVE_INFINITY;
  return ca <= cb ? a : b;
}

export function useRuptureAlerts(): UseRuptureAlertsResult {
  const enabled = isFeatureEnabled('useEmaRupture');

  const query = useQuery({
    queryKey: ['rupture-alerts', 'mv_stock_rupture_alert', 'v2'],
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    queryFn: async (): Promise<RuptureAlertRow[]> => {
      const client = supabase as unknown as {
        from: (n: string) => {
          select: (c: string) => {
            eq: (k: string, v: boolean) => {
              order: (
                k: string,
                o?: { ascending?: boolean; nullsFirst?: boolean },
              ) => {
                limit: (
                  n: number,
                ) => Promise<{ data: RuptureAlertRow[] | null; error: Error | null }>;
              };
            };
          };
        };
      };
      const { data, error } = await client
        .from('mv_stock_rupture_alert')
        .select(
          'variant_id, supplier_id, supplier_name, nivel_alerta, cobertura_dias, lead_time_efetivo, ema_diaria, current_stock, prioridade, is_preferred',
        )
        .eq('is_preferred', true)
        .order('prioridade', { ascending: true })
        .limit(MAX_ROWS);

      if (error) throw error;
      return data ?? [];
    },
  });

  const alerts = query.data ?? [];
  const byVariantId = new Map<string, RuptureAlertRow>();
  for (const a of alerts) {
    const existing = byVariantId.get(a.variant_id);
    byVariantId.set(a.variant_id, existing ? pickWorse(existing, a) : a);
  }

  return {
    alerts,
    byVariantId,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

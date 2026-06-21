/**
 * useRuptureAlerts — Consome a mat.view `mv_stock_rupture_alert` do banco
 * canônico (doufsxqlfjyuvxuezpln). Refresh da view é noturno (03:29 UTC),
 * então staleTime de 5min é seguro.
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

export function useRuptureAlerts(): UseRuptureAlertsResult {
  const enabled = isFeatureEnabled('useEmaRupture');

  const query = useQuery({
    queryKey: ['rupture-alerts', 'mv_stock_rupture_alert'],
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    queryFn: async (): Promise<RuptureAlertRow[]> => {
      // mv_stock_rupture_alert vive no canônico, fora de types.ts ainda.
      const { data, error } = await (supabase as unknown as {
        from: (n: string) => {
          select: (c: string) => {
            eq: (k: string, v: boolean) => {
              order: (
                k: string,
                o?: { ascending?: boolean; nullsFirst?: boolean },
              ) => Promise<{ data: RuptureAlertRow[] | null; error: Error | null }>;
            };
          };
        };
      })
        .from('mv_stock_rupture_alert')
        .select(
          'variant_id, supplier_id, supplier_name, nivel_alerta, cobertura_dias, lead_time_efetivo, ema_diaria, current_stock, prioridade, is_preferred',
        )
        .eq('is_preferred', true)
        .order('prioridade', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const alerts = query.data ?? [];
  const byVariantId = new Map<string, RuptureAlertRow>();
  for (const a of alerts) byVariantId.set(a.variant_id, a);

  return {
    alerts,
    byVariantId,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

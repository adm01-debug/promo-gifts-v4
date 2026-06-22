/**
 * useRuptureAlerts — Consome `mv_stock_rupture_alert` do canônico.
 * Onda 2: inclui score_composto, confidence_level, anomalia_spike, gap_unidades.
 *
 * FIX 2026-06-22: MAX_ROWS 2000→5000 + filtro neq('nivel_alerta','OK')
 * Root cause: 3.700 RUPTURA (score=100) bloqueavam todos os CRÍTICO/ALERTA/ATENÇÃO
 * quando o LIMIT era 2000. Com neq OK + limit 5000, cobrimos os 4.773 itens não-OK.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isFeatureEnabled } from '@/lib/feature-flags';

export type RuptureLevel = 'ALERTA' | 'ATENÇÃO' | 'CRÍTICO' | 'OK' | 'RUPTURA';
export type ConfidenceLevel = 'ALTA' | 'BAIXA' | 'INSUFICIENTE' | 'MÉDIA';

export interface RuptureAlertRow {
  vss_id: string | null;
  variant_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_sku: string | null;
  nivel_alerta: RuptureLevel;
  cobertura_dias: number | null;
  lead_time_efetivo: number | null;
  ema_diaria: number | null;
  stock_total: number | null;
  prioridade: number | null;
  is_preferred: boolean | null;
  // Onda 2
  score_composto: number | null;
  confidence_level: ConfidenceLevel | null;
  anomalia_spike: boolean | null;
  gap_unidades: number | null;
  valor_estoque_reais: number | null;
}

interface UseRuptureAlertsResult {
  alerts: RuptureAlertRow[];
  byVariantId: Map<string, RuptureAlertRow>;
  isLoading: boolean;
  error: Error | null;
}

/** Total itens não-OK ≈ 4.773 (RUPTURA+CRÍTICO+ALERTA+ATENÇÃO).
 *  5000 cobre com margem sem carregar os ~13k OK invisíveis no painel. */
const MAX_ROWS = 5000;
const EMPTY: RuptureAlertRow[] = [];

function pickWorse(a: RuptureAlertRow, b: RuptureAlertRow): RuptureAlertRow {
  const pa = a.prioridade ?? 9999;
  const pb = b.prioridade ?? 9999;
  if (pa !== pb) return pa < pb ? a : b;
  const sa = a.score_composto ?? 0;
  const sb = b.score_composto ?? 0;
  return sa >= sb ? a : b;
}

export function useRuptureAlerts(): UseRuptureAlertsResult {
  const enabled = isFeatureEnabled('useEmaRupture');

  const query = useQuery({
    queryKey: ['rupture-alerts', 'mv_stock_rupture_alert', 'v5'],
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    queryFn: async (): Promise<RuptureAlertRow[]> => {
      const client = supabase as unknown as {
        from: (n: string) => {
          select: (c: string) => {
            eq: (
              k: string,
              v: boolean,
            ) => {
              neq: (
                k: string,
                v: string,
              ) => {
                order: (
                  k: string,
                  o?: { ascending?: boolean },
                ) => {
                  order: (
                    k: string,
                    o?: { ascending?: boolean },
                  ) => {
                    limit: (
                      n: number,
                    ) => Promise<{ data: RuptureAlertRow[] | null; error: Error | null }>;
                  };
                };
              };
            };
          };
        };
      };
      const { data, error } = await client
        .from('mv_stock_rupture_alert')
        .select(
          'vss_id, variant_id, supplier_id, supplier_name, supplier_sku,' +
            'nivel_alerta, cobertura_dias, lead_time_efetivo, ema_diaria, stock_total,' +
            'prioridade, is_preferred, score_composto, confidence_level,' +
            'anomalia_spike, gap_unidades, valor_estoque_reais',
        )
        .eq('is_preferred', true)
        .neq('nivel_alerta', 'OK')
        .order('prioridade', { ascending: true })
        .order('score_composto', { ascending: false })
        .limit(MAX_ROWS);
      if (error) throw error;
      return data ?? [];
    },
  });

  const alerts = query.data ?? EMPTY;
  const byVariantId = useMemo(() => {
    const map = new Map<string, RuptureAlertRow>();
    for (const a of alerts) {
      const existing = map.get(a.variant_id);
      map.set(a.variant_id, existing ? pickWorse(existing, a) : a);
    }
    return map;
  }, [alerts]);

  return {
    alerts,
    byVariantId,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

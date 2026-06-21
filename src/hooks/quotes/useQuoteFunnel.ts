/**
 * useQuoteFunnel — calcula contagens por etapa do funil e ciclo médio de venda.
 * Etapas: draft → sent → viewed → approved → converted.
 * "viewed" é inferido: status sent/approved/converted COM viewed_at via tokens.
 */
import { useMemo } from 'react';
import type { Quote } from '@/hooks/quotes';

export interface FunnelStage {
  id: 'approved' | 'converted' | 'draft' | 'sent' | 'viewed';
  label: string;
  count: number;
  /** Taxa relativa à etapa anterior (0–100) */
  rateFromPrev: number | null;
}

export interface QuoteFunnelData {
  stages: FunnelStage[];
  /** Ciclo médio em dias entre created_at e (approved/converted) */
  avgCycleDays: number | null;
  /** Total de orçamentos considerados */
  total: number;
}

export function useQuoteFunnel(
  quotes: Quote[],
  viewedMap: Record<string, { viewedAt: string }>,
): QuoteFunnelData {
  return useMemo(() => {
    const total = quotes.length;
    const sent = quotes.filter((q) =>
      ['sent', 'pending', 'pending_approval'].includes(q.status as string),
    ).length;
    const approved = quotes.filter((q) => q.status === 'approved').length;
    const converted = quotes.filter((q) => q.status === 'converted').length;

    // viewed = sent OU adiante COM evidência de visualização
    const viewedQualifying = quotes.filter(
      (q) =>
        ['sent', 'pending', 'approved', 'converted'].includes(q.status as string) &&
        q.id &&
        viewedMap[q.id],
    ).length;

    // Funil cumulativo (cada etapa inclui as posteriores)
    const sentTotal = sent + approved + converted;
    const viewedTotal = viewedQualifying + approved + converted;
    const approvedTotal = approved + converted;

    const stages: FunnelStage[] = [
      { id: 'draft', label: 'Rascunho', count: total, rateFromPrev: null },
      {
        id: 'sent',
        label: 'Enviado',
        count: sentTotal,
        rateFromPrev: total > 0 ? (sentTotal / total) * 100 : 0,
      },
      {
        id: 'viewed',
        label: 'Visualizado',
        count: viewedTotal,
        rateFromPrev: sentTotal > 0 ? (viewedTotal / sentTotal) * 100 : 0,
      },
      {
        id: 'approved',
        label: 'Aprovado',
        count: approvedTotal,
        rateFromPrev: viewedTotal > 0 ? (approvedTotal / viewedTotal) * 100 : 0,
      },
      {
        id: 'converted',
        label: 'Convertido',
        count: converted,
        rateFromPrev: approvedTotal > 0 ? (converted / approvedTotal) * 100 : 0,
      },
    ];

    // Ciclo médio: created_at → updated_at de quotes aprovadas/convertidas
    const closed = quotes.filter(
      (q) => ['approved', 'converted'].includes(q.status as string) && q.created_at && q.updated_at,
    );
    const avgCycleDays =
      closed.length > 0
        ? closed.reduce((sum, q) => {
            if (!q.created_at || !q.updated_at) return sum;
            const start = new Date(q.created_at).getTime();
            const end = new Date(q.updated_at).getTime();
            return sum + (end - start) / (1000 * 60 * 60 * 24);
          }, 0) / closed.length
        : null;

    return { stages, avgCycleDays, total };
  }, [quotes, viewedMap]);
}

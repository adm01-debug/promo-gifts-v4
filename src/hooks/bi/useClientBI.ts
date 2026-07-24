/**
 * useClientBI — orquestra estatísticas 360° do cliente.
 * Tenta dados reais (orders); se vazio, retorna mock com flag `isMock: true`.
 * Sprint 3: também calcula deltas vs período anterior (90d atual vs 90d anteriores).
 */
import { useMemo } from 'react';
import { useClientOrdersHistory } from '@/hooks/bi/useClientOrdersHistory';
import { MOCK_CLIENT_STATS } from '@/lib/bi/mockData';

export interface PeriodDelta {
  ltvDeltaPct: number;
  avgTicketDeltaPct: number;
  ordersCountDeltaPct: number;
  hasPreviousData: boolean;
}

export interface ClientBI {
  isMock: boolean;
  ltv: number;
  avgTicket: number;
  ordersCount: number;
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
  topCategories: Array<{ category: string; count: number; revenue: number }>;
  recentOrders: Array<{
    id: string;
    date: string;
    total: number;
    itemsCount: number;
    productPreview: string;
    isAnomaly: boolean;
    deviation: number; // z-score (σ)
  }>;
  /** Métricas restritas aos últimos 90 dias */
  current90d: { ltv: number; avgTicket: number; ordersCount: number };
  /** Métricas dos 90 dias anteriores (90-180d atrás) */
  previous90d: { ltv: number; avgTicket: number; ordersCount: number };
  /** Variação percentual current vs previous */
  delta: PeriodDelta;
  isLoading: boolean;
}

const DAY_MS = 86400000;

function pctDelta(current: number, previous: number): number {
  if (!previous || previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function useClientBI(clientId?: string): ClientBI {
  const { data, isLoading } = useClientOrdersHistory(clientId);

  return useMemo(() => {
    if (!data || data.ordersCount === 0) {
      const mockOrders = MOCK_CLIENT_STATS.recentOrders.map((o) => ({
        ...o,
        isAnomaly: false,
        deviation: 0,
      }));
      return {
        isMock: true,
        ...MOCK_CLIENT_STATS,
        recentOrders: mockOrders,
        lastOrderDate: MOCK_CLIENT_STATS.lastOrderDate,
        daysSinceLastOrder: MOCK_CLIENT_STATS.daysSinceLastOrder,
        current90d: {
          ltv: MOCK_CLIENT_STATS.ltv * 0.35,
          avgTicket: MOCK_CLIENT_STATS.avgTicket,
          ordersCount: Math.max(1, Math.floor(MOCK_CLIENT_STATS.ordersCount * 0.3)),
        },
        previous90d: {
          ltv: MOCK_CLIENT_STATS.ltv * 0.28,
          avgTicket: MOCK_CLIENT_STATS.avgTicket * 0.92,
          ordersCount: Math.max(1, Math.floor(MOCK_CLIENT_STATS.ordersCount * 0.25)),
        },
        delta: {
          ltvDeltaPct: 25,
          avgTicketDeltaPct: 8,
          ordersCountDeltaPct: 20,
          hasPreviousData: true,
        },
        isLoading,
      };
    }

    const daysSince = data.lastOrderAt
      ? Math.floor((Date.now() - new Date(data.lastOrderAt).getTime()) / DAY_MS)
      : null;

    // Buckets temporais (90d / 90-180d)
    const now = Date.now();
    const cutCurrent = now - 90 * DAY_MS;
    const cutPrevious = now - 180 * DAY_MS;
    const valid = data.orders.filter((o) => o.status !== 'cancelled');

    const inCurrent = valid.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= cutCurrent;
    });
    const inPrevious = valid.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= cutPrevious && t < cutCurrent;
    });

    const sumLtv = (arr: typeof valid) => arr.reduce((s, o) => s + (o.total ?? 0), 0);
    const cur = {
      ltv: sumLtv(inCurrent),
      ordersCount: inCurrent.length,
      avgTicket: inCurrent.length ? sumLtv(inCurrent) / inCurrent.length : 0,
    };
    const prev = {
      ltv: sumLtv(inPrevious),
      ordersCount: inPrevious.length,
      avgTicket: inPrevious.length ? sumLtv(inPrevious) / inPrevious.length : 0,
    };

    return {
      isMock: false,
      ltv: data.totalLtv,
      avgTicket: data.avgTicket,
      ordersCount: data.ordersCount,
      lastOrderDate: data.lastOrderAt,
      daysSinceLastOrder: daysSince,
      // Categorias reais ainda não temos (depende de order_items + categoria) — fallback mock parcial
      topCategories: MOCK_CLIENT_STATS.topCategories,
      recentOrders: (() => {
        const totals = valid.map((o) => o.total ?? 0).filter((t) => t > 0);
        const mean = totals.length > 0 ? totals.reduce((s, v) => s + v, 0) / totals.length : 0;
        const variance =
          totals.length > 1 ? totals.reduce((s, v) => s + (v - mean) ** 2, 0) / totals.length : 0;
        const sigma = Math.sqrt(variance);
        return data.orders.slice(0, 5).map((o) => {
          const total = o.total ?? 0;
          const dev = sigma > 0 ? (total - mean) / sigma : 0;
          return {
            id: o.order_number,
            date: o.created_at,
            total,
            itemsCount: 1,
            productPreview: o.notes?.slice(0, 60) ?? 'Pedido',
            isAnomaly: Math.abs(dev) > 2 && totals.length >= 4,
            deviation: Math.round(dev * 10) / 10,
          };
        });
      })(),
      current90d: cur,
      previous90d: prev,
      delta: {
        ltvDeltaPct: pctDelta(cur.ltv, prev.ltv),
        avgTicketDeltaPct: pctDelta(cur.avgTicket, prev.avgTicket),
        ordersCountDeltaPct: pctDelta(cur.ordersCount, prev.ordersCount),
        hasPreviousData: inPrevious.length > 0,
      },
      isLoading,
    };
  }, [data, isLoading]);
}

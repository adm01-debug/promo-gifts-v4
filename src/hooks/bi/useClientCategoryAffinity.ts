/**
 * useClientCategoryAffinity — agrega histórico do cliente por CATEGORIA.
 *
 * Reaproveita o RPC `get_client_top_products` (já usado em useClientAffinity)
 * e dobra o resultado por categoria via `categoryResolver`. Quando vazio,
 * cai para mock determinístico baseado em MOCK_CLIENT_STATS.topCategories.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveBICategory, type BICategorySlug } from '@/lib/bi/categoryResolver';
import { MOCK_CLIENT_STATS } from '@/lib/bi/mockData';

export interface ClientTopProductRow {
  product_id: string | null;
  product_name: string;
  product_image_url: string | null;
  total_quantity: number;
  occurrences: number;
  total_revenue: number;
  avg_unit_price: number;
  last_quoted_at: string | null;
}

export interface CategoryAggregate {
  slug: BICategorySlug | 'outros';
  label: string;
  occurrences: number;
  totalQuantity: number;
  totalRevenue: number;
  /** % da receita do cliente que essa categoria representa */
  revenueSharePct: number;
  /** Receita nos últimos 90 dias */
  revenueRecent: number;
  /** Receita 90-180 dias atrás */
  revenuePrevious: number;
  /** Variação % entre janela recente e anterior (null se sem dados anteriores) */
  deltaPct: number | null;
  /** Tendência categórica baseada em deltaPct (limiar ±15%) */
  trend: 'up' | 'down' | 'stable';
  /** Top produtos REAIS dessa categoria (até 5) */
  topProducts: Array<{
    productId: string | null;
    productName: string;
    imageUrl: string | null;
    quantity: number;
    revenue: number;
    avgPrice: number;
  }>;
}

export interface ClientCategoryAffinityResult {
  isMock: boolean;
  realProductsCount: number;
  /** Categorias ordenadas por receita desc */
  categories: CategoryAggregate[];
  /** Categoria favorita (top 1) — null se nenhuma */
  favorite: CategoryAggregate | null;
}

function buildMockResult(): ClientCategoryAffinityResult {
  const totalRev = MOCK_CLIENT_STATS.topCategories.reduce((s, c) => s + c.revenue, 0) || 1;
  // Mock: distribuir 60% receita "recente" e 40% "anterior" com leve variação determinística por slug
  const categories: CategoryAggregate[] = MOCK_CLIENT_STATS.topCategories.map((c, i) => {
    const meta = resolveBICategory(c.category, c.category);
    const recentBias = 0.55 + ((i % 3) - 1) * 0.12; // 0.43, 0.55, 0.67
    const revenueRecent = c.revenue * recentBias;
    const revenuePrevious = c.revenue * (1 - recentBias);
    const deltaPct =
      revenuePrevious > 0 ? ((revenueRecent - revenuePrevious) / revenuePrevious) * 100 : null;
    const trend: CategoryAggregate['trend'] =
      deltaPct === null ? 'stable' : deltaPct > 15 ? 'up' : deltaPct < -15 ? 'down' : 'stable';
    return {
      slug: meta.slug,
      label: c.category,
      occurrences: c.count,
      totalQuantity: c.count * 12,
      totalRevenue: c.revenue,
      revenueSharePct: (c.revenue / totalRev) * 100,
      revenueRecent,
      revenuePrevious,
      deltaPct,
      trend,
      topProducts: [],
    };
  });
  return {
    isMock: true,
    realProductsCount: 0,
    categories,
    favorite: categories[0] ?? null,
  };
}

export function useClientCategoryAffinity(clientId?: string) {
  const query = useQuery<ClientTopProductRow[]>({
    queryKey: ['bi-client-category-affinity-raw', clientId],
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase.rpc('get_client_top_products', {
        _client_id: clientId,
        _limit: 50,
      });
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
  });

  const result = useMemo<ClientCategoryAffinityResult>(() => {
    const rows = query.data ?? [];
    if (rows.length === 0) return buildMockResult();

    const now = Date.now();
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    const recentCutoff = now - NINETY_DAYS;
    const previousCutoff = now - 2 * NINETY_DAYS;

    const byCat = new Map<string, CategoryAggregate>();
    for (const r of rows) {
      const meta = resolveBICategory(r.product_name);
      const key = meta.slug;
      const cur =
        byCat.get(key) ??
        ({
          slug: meta.slug,
          label: meta.label,
          occurrences: 0,
          totalQuantity: 0,
          totalRevenue: 0,
          revenueSharePct: 0,
          revenueRecent: 0,
          revenuePrevious: 0,
          deltaPct: null,
          trend: 'stable' as const,
          topProducts: [],
        } satisfies CategoryAggregate);
      const revenue = Number(r.total_revenue) || 0;
      cur.occurrences += Number(r.occurrences) || 0;
      cur.totalQuantity += Number(r.total_quantity) || 0;
      cur.totalRevenue += revenue;

      // Bucket temporal — usa last_quoted_at como aproximação (RPC não retorna histórico granular).
      if (r.last_quoted_at) {
        const ts = new Date(r.last_quoted_at).getTime();
        if (!Number.isNaN(ts)) {
          if (ts >= recentCutoff) cur.revenueRecent += revenue;
          else if (ts >= previousCutoff) cur.revenuePrevious += revenue;
        }
      }

      cur.topProducts.push({
        productId: r.product_id,
        productName: r.product_name,
        imageUrl: r.product_image_url,
        quantity: Number(r.total_quantity) || 0,
        revenue,
        avgPrice: Number(r.avg_unit_price) || 0,
      });
      byCat.set(key, cur);
    }

    const totalRev = [...byCat.values()].reduce((s, c) => s + c.totalRevenue, 0) || 1;
    const categories = [...byCat.values()]
      .map((c) => {
        const deltaPct =
          c.revenuePrevious > 0
            ? ((c.revenueRecent - c.revenuePrevious) / c.revenuePrevious) * 100
            : c.revenueRecent > 0
              ? 100
              : null;
        const trend: CategoryAggregate['trend'] =
          deltaPct === null ? 'stable' : deltaPct > 15 ? 'up' : deltaPct < -15 ? 'down' : 'stable';
        return {
          ...c,
          revenueSharePct: (c.totalRevenue / totalRev) * 100,
          deltaPct,
          trend,
          topProducts: c.topProducts.sort((a, b) => b.revenue - a.revenue).slice(0, 5),
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      isMock: false,
      realProductsCount: rows.length,
      categories,
      favorite: categories[0] ?? null,
    };
  }, [query.data]);

  return { ...result, isLoading: query.isLoading };
}

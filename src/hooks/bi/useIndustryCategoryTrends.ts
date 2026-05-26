/**
 * useIndustryCategoryTrends — agrega top produtos do setor por CATEGORIA.
 *
 * Reaproveita o RPC `get_industry_top_products` (já usado em useIndustryTrends)
 * e dobra o resultado por categoria. Quando vazio, cai para mock derivado
 * de getMockIndustryTrends.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectCrm } from '@/lib/crm-db';
import { resolveBICategory, type BICategorySlug } from '@/lib/bi/categoryResolver';
import { getMockIndustryTrends } from '@/lib/bi/mockData';

export interface IndustryCategoryAggregate {
  slug: BICategorySlug | 'outros';
  label: string;
  totalQuantity: number;
  uniqueClients: number;
  totalRevenue: number;
  /** % da receita do setor que essa categoria representa */
  revenueSharePct: number;
  topProducts: Array<{
    productId: string | null;
    productName: string;
    imageUrl: string | null;
    quantity: number;
    revenue: number;
    avgPrice: number;
  }>;
}

export interface IndustryCategoryTrendsResult {
  isMock: boolean;
  companiesInRamo: number;
  categories: IndustryCategoryAggregate[];
}

interface IndustryRow {
  product_id: string | null;
  product_name: string;
  product_image_url: string | null;
  total_quantity: number;
  unique_clients: number;
  total_revenue: number;
  avg_unit_price: number;
}

function buildMockResult(ramo?: string | null): IndustryCategoryTrendsResult {
  const trends = getMockIndustryTrends(ramo);
  const byCat = new Map<string, IndustryCategoryAggregate>();
  for (const t of trends) {
    const meta = resolveBICategory(t.productName, t.category);
    const key = meta.slug;
    const cur = byCat.get(key) ?? {
      slug: meta.slug,
      label: meta.label,
      totalQuantity: 0,
      uniqueClients: 0,
      totalRevenue: 0,
      revenueSharePct: 0,
      topProducts: [],
    };
    cur.totalQuantity += t.unitsSold;
    cur.uniqueClients += t.ordersCount;
    cur.totalRevenue += t.unitsSold * t.avgPrice;
    cur.topProducts.push({
      productId: null,
      productName: t.productName,
      imageUrl: null,
      quantity: t.unitsSold,
      revenue: t.unitsSold * t.avgPrice,
      avgPrice: t.avgPrice,
    });
    byCat.set(key, cur);
  }
  const totalRev = Array.from(byCat.values()).reduce((s, c) => s + c.totalRevenue, 0) || 1;
  const categories = Array.from(byCat.values())
    .map((c) => ({
      ...c,
      revenueSharePct: (c.totalRevenue / totalRev) * 100,
      topProducts: c.topProducts.sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
  return { isMock: true, companiesInRamo: 0, categories };
}

export function useIndustryCategoryTrends(ramoAtividade?: string | null) {
  const query = useQuery<IndustryCategoryTrendsResult>({
    queryKey: ['bi-industry-category-trends', ramoAtividade],
    enabled: !!ramoAtividade,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!ramoAtividade) return buildMockResult(null);

      let companyIds: string[] = [];
      try {
        const companies = await selectCrm<{ id: string }>('companies', {
          select: 'id',
          filters: { ramo_atividade: ramoAtividade, deleted_at: null },
          limit: 500,
        });
        companyIds = companies.map((c) => c.id).filter(Boolean);
      } catch {
        companyIds = [];
      }

      if (companyIds.length === 0) return buildMockResult(ramoAtividade);

      const { data, error } = await supabase.rpc('get_industry_top_products', {
        _company_ids: companyIds,
        _days: 90,
        _limit: 50,
      });

      const rows = (!error && Array.isArray(data) ? data : []) as IndustryRow[];
      if (rows.length === 0) {
        return { ...buildMockResult(ramoAtividade), companiesInRamo: companyIds.length };
      }

      const byCat = new Map<string, IndustryCategoryAggregate>();
      for (const r of rows) {
        const meta = resolveBICategory(r.product_name);
        const key = meta.slug;
        const cur = byCat.get(key) ?? {
          slug: meta.slug,
          label: meta.label,
          totalQuantity: 0,
          uniqueClients: 0,
          totalRevenue: 0,
          revenueSharePct: 0,
          topProducts: [],
        };
        cur.totalQuantity += Number(r.total_quantity) || 0;
        cur.uniqueClients += Number(r.unique_clients) || 0;
        cur.totalRevenue += Number(r.total_revenue) || 0;
        cur.topProducts.push({
          productId: r.product_id,
          productName: r.product_name,
          imageUrl: r.product_image_url,
          quantity: Number(r.total_quantity) || 0,
          revenue: Number(r.total_revenue) || 0,
          avgPrice: Number(r.avg_unit_price) || 0,
        });
        byCat.set(key, cur);
      }
      const totalRev = Array.from(byCat.values()).reduce((s, c) => s + c.totalRevenue, 0) || 1;
      const categories = Array.from(byCat.values())
        .map((c) => ({
          ...c,
          revenueSharePct: (c.totalRevenue / totalRev) * 100,
          topProducts: c.topProducts.sort((a, b) => b.revenue - a.revenue).slice(0, 5),
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      return { isMock: false, companiesInRamo: companyIds.length, categories };
    },
  });

  return useMemo(
    () =>
      query.data ?? {
        isMock: true,
        companiesInRamo: 0,
        categories: [] as IndustryCategoryAggregate[],
      },
    [query.data],
  ).categories.length === 0
    ? { ...(query.data ?? buildMockResult(ramoAtividade)), isLoading: query.isLoading }
    : { ...(query.data as IndustryCategoryTrendsResult), isLoading: query.isLoading };
}

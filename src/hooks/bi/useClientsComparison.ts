/**
 * useClientsComparison — paraleliza dados de até 3 clientes para comparação lado-a-lado.
 * Composição de hooks BI existentes (sem novas RPCs).
 */
import { useMemo } from 'react';
import { useClientHealthScore } from '@/hooks/bi/useClientHealthScore';
import { useClientBI } from '@/hooks/bi/useClientBI';
import { useClientSeasonality } from '@/hooks/bi/useClientSeasonality';
import { useClientAffinity } from '@/hooks/bi/useClientAffinity';
import { useClientCategoryAffinity } from '@/hooks/bi/useClientCategoryAffinity';
import { useIndustryCategoryTrends } from '@/hooks/bi/useIndustryCategoryTrends';
import { useCrmCompany } from '@/hooks/crm';
import { getCompanyDisplayName } from '@/types/crm';

export interface ClientComparisonRow {
  clientId: string;
  clientName: string;
  ramoAtividade: string | null;
  isLoading: boolean;
  score: number;
  tier: 'healthy' | 'attention' | 'risk' | 'unknown';
  ltv: number;
  avgTicket: number;
  ordersCount: number;
  daysSinceLastOrder: number | null;
  topCategory: string | null;
  /** Categoria favorita do eixo CATEGORIA (com share) */
  favoriteCategoryLabel: string | null;
  favoriteCategorySharePct: number;
  /** Categoria de oportunidade GAP (setor compra, cliente não) */
  opportunityCategoryLabel: string | null;
  opportunityCategorySharePct: number;
  nextPeakLabel: string;
  daysToNextPeak: number | null;
  shareOfWalletPct: number;
}

/** Hook por cliente (precisa ser chamado em ordem fixa). */
export function useSingleClientComparisonRow(clientId: string): ClientComparisonRow {
  const { data: company } = useCrmCompany(clientId);
  const ramo = company?.ramo_atividade ?? null;
  const health = useClientHealthScore(clientId, ramo);
  const bi = useClientBI(clientId);
  const seas = useClientSeasonality(clientId, ramo);
  const affinity = useClientAffinity(clientId);
  const catAffinity = useClientCategoryAffinity(clientId);
  const catIndustry = useIndustryCategoryTrends(ramo);

  const topCategory =
    catAffinity.favorite?.label ??
    affinity.data?.categories?.[0]?.category ??
    bi.topCategories?.[0]?.category ??
    null;

  const favoriteCategoryLabel = catAffinity.favorite?.label ?? null;
  const favoriteCategorySharePct = Math.round(catAffinity.favorite?.revenueSharePct ?? 0);

  // GAP: categoria forte do setor que o cliente não compra
  const { opportunityCategoryLabel, opportunityCategorySharePct } = useMemo(() => {
    const clientSlugs = new Set(catAffinity.categories.map((c) => c.slug));
    const opportunity = catIndustry.categories.find(
      (ind) => !clientSlugs.has(ind.slug) && ind.revenueSharePct >= 8,
    );
    return {
      opportunityCategoryLabel: opportunity?.label ?? null,
      opportunityCategorySharePct: Math.round(opportunity?.revenueSharePct ?? 0),
    };
  }, [catAffinity.categories, catIndustry.categories]);

  const nextPeakLabel =
    seas.daysToNextPeak === 0
      ? 'Hoje'
      : seas.daysToNextPeak !== null && seas.nextPeakMonth !== null
        ? `${seas.daysToNextPeak}d`
        : '—';

  return {
    clientId,
    clientName: company ? getCompanyDisplayName(company) : 'Cliente',
    ramoAtividade: ramo,
    isLoading:
      health.isLoading ||
      bi.isLoading ||
      seas.isLoading ||
      catAffinity.isLoading ||
      catIndustry.isLoading,
    score: health.score,
    tier: health.tier,
    ltv: bi.ltv,
    avgTicket: bi.avgTicket,
    ordersCount: bi.ordersCount,
    daysSinceLastOrder: bi.daysSinceLastOrder,
    topCategory,
    favoriteCategoryLabel,
    favoriteCategorySharePct,
    opportunityCategoryLabel,
    opportunityCategorySharePct,
    nextPeakLabel,
    daysToNextPeak: seas.daysToNextPeak,
    shareOfWalletPct: health.shareOfWalletPct,
  };
}

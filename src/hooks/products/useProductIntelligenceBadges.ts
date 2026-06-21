/**
 * useProductIntelligenceBadges
 * Computes smart commercial badges for a product based on:
 * 1. Catalog flags (featured, new_arrival, etc.) from mv_product_intelligence
 * 2. Stock velocity trend (emerging, declining) from mv_stock_velocity
 * 3. Restock cadence (frequent_restock flag)
 * Uses real data from mv_product_intelligence + mv_stock_velocity,
 * falls back to seeded mock data for demo/loading states.
 *
 * Os limiares e o liga/desliga de `hot-item` / `best-seller` vêm de
 * `admin_settings.intelligence_badges` via {@link useIntelligenceBadgeSettingsValue},
 * permitindo ajuste sem deploy.
 */
import { useMemo } from 'react';
import {
  useProductIntelligenceData,
  useStockVelocity,
  type StockVelocity,
  type ProductIntelligenceData,
} from '@/hooks/intelligence';
import { generateMockVelocities, generateMockIntelligence } from '@/lib/stock-chart-utils';
import { useIntelligenceBadgeSettingsValue } from '@/hooks/admin/useIntelligenceBadgeSettings';

type BadgeType =
  | 'best-seller'
  | 'class-a'
  | 'declining'
  | 'emerging'
  | 'featured'
  | 'frequent-restock'
  | 'hot-item'
  | 'last-units'
  | 'new-arrival';

export interface IntelligenceBadge {
  type: BadgeType;
  label: string;
  icon: string;
  color: string;
  priority: number;
  /** Texto explicativo exibido no tooltip — descreve o critério/valor usado. */
  description?: string;
}

export function useProductIntelligenceBadges(
  productId: string | undefined,
  catalogFlags?: {
    featured?: boolean;
    new_arrival?: boolean;
  },
) {
  const { data: intelligence, isLoading: loadingIntel } = useProductIntelligenceData(productId);
  const { data: velocity, isLoading: loadingVel } = useStockVelocity(productId);
  const settings = useIntelligenceBadgeSettingsValue();

  const badges = useMemo((): IntelligenceBadge[] => {
    const mockVels: StockVelocity[] = productId ? generateMockVelocities(productId) : [];
    const mockIntel: ProductIntelligenceData | null = productId
      ? generateMockIntelligence(productId)
      : null;

    const effectiveIntel: ProductIntelligenceData | null = intelligence ?? mockIntel;
    const effectiveVels: StockVelocity[] = velocity?.length ? velocity : mockVels;

    const out: IntelligenceBadge[] = [];

    if (catalogFlags?.featured) {
      out.push({
        type: 'featured',
        label: 'Destaque',
        icon: '⭐',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        priority: 100,
        description: 'Produto marcado como Destaque na ficha cadastral.',
      });
    }
    if (catalogFlags?.new_arrival) {
      out.push({
        type: 'new-arrival',
        label: 'Lançamento',
        icon: '🌟',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        priority: 90,
        description: 'Produto recém-cadastrado, sinalizado como Lançamento.',
      });
    }

    if (effectiveIntel?.is_hot_product && settings.hotItem.enabled) {
      out.push({
        type: 'hot-item',
        label: 'Hot Item',
        icon: '🔥',
        color: 'bg-brand-primary-100 text-brand-primary-800 border-brand-primary-200',
        priority: 80,
        description:
          'Sinalizado como Hot Item pela Inteligência Comercial (alta procura + reposição recente).',
      });
    }

    const bestVel = effectiveVels.length
      ? effectiveVels.reduce(
          (best: StockVelocity, v: StockVelocity) =>
            v.avg_daily_depletion_7d > (best?.avg_daily_depletion_7d ?? 0) ? v : best,
          effectiveVels[0],
        )
      : null;
    const trend = bestVel?.velocity_trend;

    if (trend && trend > 1.3) {
      out.push({
        type: 'emerging',
        label: 'Emergente',
        icon: '📈',
        color: 'bg-green-100 text-green-800 border-green-200',
        priority: 70,
        description: `Velocidade de venda subiu ${Math.round((trend - 1) * 100)}% vs período anterior.`,
      });
    } else if (trend && trend < 0.7) {
      out.push({
        type: 'declining',
        label: 'Em queda',
        icon: '📉',
        color: 'bg-red-100 text-red-800 border-red-200',
        priority: 65,
        description: `Velocidade de venda caiu ${Math.round((1 - trend) * 100)}% vs período anterior.`,
      });
    }

    if (effectiveIntel?.abc_classification === 'A') {
      out.push({
        type: 'class-a',
        label: 'Classe A',
        icon: '🏆',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        priority: 60,
        description: 'Classificação ABC: top de receita/giro no portfólio do fornecedor.',
      });
    }

    if (effectiveIntel?.has_frequent_restock) {
      out.push({
        type: 'frequent-restock',
        label: 'Reposição freq.',
        icon: '🔄',
        color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        priority: 50,
        description: 'Fornecedor repõe estoque com frequência — baixo risco de ruptura.',
      });
    }

    if (effectiveIntel?.is_stockout_risk) {
      out.push({
        type: 'last-units',
        label: 'Últ. unidades',
        icon: '⚠️',
        color: 'bg-red-50 text-red-700 border-red-200',
        priority: 85,
        description: 'Risco alto de ruptura: estoque baixo + velocidade alta.',
      });
    }

    const avgDepletion = bestVel?.avg_daily_depletion_7d ?? 0;
    const minDepletion = settings.bestSeller.minAvgDailyDepletion7d;
    if (
      settings.bestSeller.enabled &&
      Number.isFinite(avgDepletion) &&
      avgDepletion >= minDepletion
    ) {
      out.push({
        type: 'best-seller',
        label: 'Best-seller',
        icon: '🏅',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        priority: 75,
        description: `Vende em média ${avgDepletion.toFixed(1)} un/dia nos últimos 7 dias (limite ≥ ${minDepletion}).`,
      });
    }

    return out.sort((a, b) => b.priority - a.priority);
  }, [intelligence, velocity, catalogFlags, productId, settings]);

  return {
    badges,
    isLoading: loadingIntel || loadingVel,
  };
}

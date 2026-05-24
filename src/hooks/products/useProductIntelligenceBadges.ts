/**
 * useProductIntelligenceBadges
 * Computes smart commercial badges for a product based on:
 * 1. Catalog flags (featured, new_arrival, etc.) from mv_product_intelligence
 * 2. Stock velocity trend (emerging, declining) from mv_stock_velocity
 * 3. Restock cadence (frequent_restock flag)
 * Uses real data from mv_product_intelligence + mv_stock_velocity,
 * falls back to seeded mock data for demo/loading states.
 */
import { useMemo } from 'react';
import { useProductIntelligenceData, useStockVelocity, type StockVelocity } from '@/hooks/intelligence';
import { generateMockVelocities, generateMockIntelligence } from '@/lib/stock-chart-utils';

type BadgeType =
  | 'featured'
  | 'new-arrival'
  | 'hot-item'
  | 'emerging'
  | 'declining'
  | 'frequent-restock'
  | 'last-units' // low stock + high velocity (stockout risk)
  | 'best-seller' // top tier velocity
  | 'class-a';   // ABC classification A

export interface IntelligenceBadge {
  type: BadgeType;
  label: string;
  icon: string;
  color: string; // Tailwind class
  priority: number;
}

export function useProductIntelligenceBadges(
  productId: string | undefined,
  catalogFlags?: {
    featured?: boolean;
    new_arrival?: boolean;
  }
) {
  const { data: intelligence, isLoading: loadingIntel } = useProductIntelligenceData(productId);
  const { data: velocity, isLoading: loadingVel } = useStockVelocity(productId);

  const badges = useMemo((): IntelligenceBadge[] => {
    const mockVels = productId ? generateMockVelocities(productId) : [];
    const mockIntel = productId ? generateMockIntelligence(productId) : null;

    const effectiveIntel = intelligence ?? mockIntel;
    const effectiveVels = velocity?.length ? velocity : mockVels;

    const badges: IntelligenceBadge[] = [];

    // === 1. Catalog flags (real data from product table) ===
    if (catalogFlags?.featured) {
      badges.push({
        type: 'featured',
        label: 'Destaque',
        icon: '⭐',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        priority: 100,
      });
    }
    if (catalogFlags?.new_arrival) {
      badges.push({
        type: 'new-arrival',
        label: 'Lançamento',
        icon: '🌟',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        priority: 90,
      });
    }

    // === 2. Hot item (from intelligence mv) ===
    if (effectiveIntel?.is_hot_product) {
      badges.push({
        type: 'hot-item',
        label: 'Hot Item',
        icon: '🔥',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        priority: 80,
      });
    }

    // === 3. Emergente (trend > 1.3) ===
    const bestVel = effectiveVels.length
      ? effectiveVels.reduce(
          (best: StockVelocity, v: StockVelocity) => (v.avg_daily_depletion_7d > (best?.avg_daily_depletion_7d ?? 0) ? v : best),
          effectiveVels[0],
        )
      : null;
    const trend = bestVel?.velocity_trend;

    if (trend && trend > 1.3) {
      badges.push({
        type: 'emerging',
        label: 'Emergente',
        icon: '📈',
        color: 'bg-green-100 text-green-800 border-green-200',
        priority: 70,
      });
    } else if (trend && trend < 0.7) {
      badges.push({
        type: 'declining',
        label: 'Em queda',
        icon: '📉',
        color: 'bg-red-100 text-red-800 border-red-200',
        priority: 65,
      });
    }

    // === 4. ABC Class A ===
    if (effectiveIntel?.abc_classification === 'A') {
      badges.push({
        type: 'class-a',
        label: 'Classe A',
        icon: '🏆',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        priority: 60,
      });
    }

    // === 5. Restock freqüente ===
    if (effectiveIntel?.has_frequent_restock) {
      badges.push({
        type: 'frequent-restock',
        label: 'Reposição freq.',
        icon: '🔄',
        color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        priority: 50,
      });
    }

    // === 6. Last units (stockout risk + high velocity) ===
    if (effectiveIntel?.is_stockout_risk) {
      badges.push({
        type: 'last-units',
        label: 'Últ. unidades',
        icon: '⚠️',
        color: 'bg-red-50 text-red-700 border-red-200',
        priority: 85,
      });
    }

    // === 7. Best-seller (top velocity) ===
    const avgDepletion = bestVel?.avg_daily_depletion_7d ?? 0;
    if (avgDepletion >= 15) {
      badges.push({
        type: 'best-seller',
        label: 'Best-seller',
        icon: '🏅',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        priority: 75,
      });
    }

    return badges.sort((a, b) => b.priority - a.priority);
  }, [intelligence, velocity, catalogFlags, productId]);

  return {
    badges,
    isLoading: loadingIntel || loadingVel,
  };
}

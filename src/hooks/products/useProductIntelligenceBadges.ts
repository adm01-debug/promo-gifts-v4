/**
 * Hook that derives visual badges from market intelligence data + catalog flags.
 * Uses real data from mv_product_intelligence + mv_stock_velocity,
 * falling back to mock data when MVs aren't populated.
 * Also incorporates catalog flags (featured, newArrival, onSale) from product data.
 */
import { useMemo } from 'react';
import { useProductIntelligenceData, useStockVelocity } from '@/hooks/useStockHistory';
import { generateMockIntelligence, generateMockVelocities } from '@/lib/stock-chart-utils';

export type IntelligenceBadgeType =
  | 'best-seller' // ABC A
  | 'popular' // ABC B
  | 'normal' // ABC C
  | 'emergente' // trend > 1.3
  | 'last-units' // low stock + high velocity (stockout risk)
  | 'featured' // catalog: product.featured
  | 'new-arrival' // catalog: product.newArrival
  | 'on-sale'; // catalog: product.onSale

export interface IntelligenceBadge {
  type: IntelligenceBadgeType;
  label: string;
  emoji: string;
  tooltip: string;
}

/** Catalog flags from the product record */
export interface CatalogFlags {
  featured?: boolean;
  newArrival?: boolean;
  onSale?: boolean;
  lowStock?: boolean; // stockStatus === "low-stock"
  stock?: number;
}

export interface ProductIntelligenceBadgesResult {
  badges: IntelligenceBadge[];
  turnoverScore: number | null;
  demandLevel: 'muito-alta' | 'alta' | 'moderada' | 'baixa' | null;
  isLoading: boolean;
  isDemo: boolean;
}

export function useProductIntelligenceBadges(
  productId?: string,
  catalogFlags?: CatalogFlags,
): ProductIntelligenceBadgesResult {
  const { data: intelligence, isLoading: loadingIntel } = useProductIntelligenceData(productId);
  const { data: velocity, isLoading: loadingVel } = useStockVelocity(productId);

  return useMemo(() => {
    const isDemo = !intelligence;
    const mockIntel = productId ? generateMockIntelligence(productId) : null;
    const mockVels = productId ? generateMockVelocities(productId) : [];

    const effectiveIntel = intelligence ?? mockIntel;
    const effectiveVels = velocity?.length ? velocity : mockVels;

    const badges: IntelligenceBadge[] = [];

    // === 1. Catalog flags (real data from product table) ===
    if (catalogFlags?.featured) {
      badges.push({
        type: 'featured',
        label: 'Destaque',
        emoji: '✨',
        tooltip: 'Produto em destaque no catálogo',
      });
    }
    if (catalogFlags?.newArrival) {
      badges.push({
        type: 'new-arrival',
        label: 'Novidade',
        emoji: '🆕',
        tooltip: 'Produto adicionado recentemente ao catálogo',
      });
    }
    if (catalogFlags?.onSale) {
      badges.push({
        type: 'on-sale',
        label: 'Promoção',
        emoji: '🏷️',
        tooltip: 'Produto com preço promocional',
      });
    }

    if (!effectiveIntel) {
      return {
        badges,
        turnoverScore: null,
        demandLevel: null,
        isLoading: loadingIntel || loadingVel,
        isDemo: true,
      };
    }

    // === 2. ABC Classification (from market intelligence) ===
    const abc = effectiveIntel.abc_classification;
    if (abc === 'A') {
      badges.push({
        type: 'best-seller',
        label: 'Best-Seller',
        emoji: '🔥',
        tooltip: 'Classe A — um dos produtos mais vendidos do mercado',
      });
    } else if (abc === 'B') {
      badges.push({
        type: 'popular',
        label: 'Popular',
        emoji: '⚡',
        tooltip: 'Classe B — boa tração comercial',
      });
    } else {
      badges.push({
        type: 'normal',
        label: 'Normal',
        emoji: '📦',
        tooltip: 'Classe C — volume regular de vendas',
      });
    }

    // === 3. Emergente (trend > 1.3) ===
    const bestVel = effectiveVels.length
      ? effectiveVels.reduce(
          (best, v) => (v.avg_daily_depletion_7d > (best?.avg_daily_depletion_7d ?? 0) ? v : best),
          effectiveVels[0],
        )
      : null;
    const trend = bestVel?.velocity_trend;
    if (trend !== null && trend > 1.3) {
      badges.push({
        type: 'emergente',
        label: 'Emergente',
        emoji: '🚀',
        tooltip: 'Vendas acelerando — tendência de crescimento > 30%',
      });
    }

    // === 4. Últimas Unidades (stockout risk) ===
    if (effectiveIntel.is_stockout_risk && effectiveIntel.total_current_stock > 0) {
      badges.push({
        type: 'last-units',
        label: 'Últimas Unidades',
        emoji: '⚠️',
        tooltip: 'Estoque baixo com alta velocidade de venda — risco real de ruptura',
      });
    }

    // Turnover score
    const turnoverScore =
      effectiveIntel.turnover_score !== null && Number.isFinite(effectiveIntel.turnover_score)
        ? Math.round(effectiveIntel.turnover_score)
        : null;

    // Demand level
    const avgDaily = bestVel?.avg_daily_depletion_7d ?? effectiveIntel.avg_velocity_7d ?? 0;
    const demandLevel: ProductIntelligenceBadgesResult['demandLevel'] =
      avgDaily >= 20
        ? 'muito-alta'
        : avgDaily >= 10
          ? 'alta'
          : avgDaily >= 3
            ? 'moderada'
            : 'baixa';

    return {
      badges,
      turnoverScore,
      demandLevel,
      isLoading: loadingIntel || loadingVel,
      isDemo,
    };
  }, [
    intelligence,
    velocity,
    productId,
    loadingIntel,
    loadingVel,
    catalogFlags?.featured,
    catalogFlags?.newArrival,
    catalogFlags?.onSale,
  ]);
}

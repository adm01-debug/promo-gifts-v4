/**
 * useComparisonScore — Score ponderado para decidir o melhor produto na comparação.
 *
 * Pesos default (somam 100):
 *  - price (35) — quanto menor melhor
 *  - stock (20) — quanto maior melhor
 *  - minQuantity (15) — quanto menor melhor
 *  - colorVariety (10) — quanto mais cores melhor
 *  - verifiedSupplier (10) — bônus se verificado
 *  - leadTime (10) — quanto menor melhor (proxy: stockStatus)
 *
 * Pesos podem ser sobrescritos pelo consumidor (popover de ajuste).
 */
import { useMemo } from 'react';

export interface ComparisonScoreWeights {
  price: number;
  stock: number;
  minQuantity: number;
  colorVariety: number;
  verifiedSupplier: number;
  leadTime: number;
}

export const DEFAULT_SCORE_WEIGHTS: ComparisonScoreWeights = {
  price: 35,
  stock: 20,
  minQuantity: 15,
  colorVariety: 10,
  verifiedSupplier: 10,
  leadTime: 10,
};

export interface ProductScore {
  productId: string;
  total: number; // 0..100
  breakdown: Record<keyof ComparisonScoreWeights, number>;
  isWinner: boolean;
  rank: number;
}

function leadTimeProxy(stockStatus: string | null | undefined): number {
  // Lower is better → in-stock=1, low-stock=2, out-of-stock=4
  switch (stockStatus) {
    case 'in-stock':
      return 1;
    case 'low-stock':
      return 2;
    case 'out-of-stock':
      return 4;
    default:
      return 2;
  }
}

function normalizeLowerBetter(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return 1 - (value - min) / (max - min);
}

function normalizeHigherBetter(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return (value - min) / (max - min);
}

export function useComparisonScore(
  products: {
    id?: string | number;
    price?: number | null;
    stock?: number | null;
    rating?: number | null;
    reviews_count?: number | null;
    minQuantity?: number | null;
    colors?: Array<{ name?: string }> | null;
    stockStatus?: string | null;
    variations?: unknown[];
    supplier?: { verified?: boolean; isVerified?: boolean; name?: string } | null;
  }[],
  weights: ComparisonScoreWeights = DEFAULT_SCORE_WEIGHTS,
): ProductScore[] {
  return useMemo(() => {
    if (!products || products.length === 0) return [];

    // Defensive: coerce every weight to a finite number. A malformed/partial
    // weights object (e.g. the persisted `{minQty,colors,verified}` shape passed
    // by mistake) would otherwise make `normalize(...) * undefined = NaN`,
    // turning every score into NaN. Missing keys collapse to 0.
    const w: ComparisonScoreWeights = {
      price: Number(weights?.price) || 0,
      stock: Number(weights?.stock) || 0,
      minQuantity: Number(weights?.minQuantity) || 0,
      colorVariety: Number(weights?.colorVariety) || 0,
      verifiedSupplier: Number(weights?.verifiedSupplier) || 0,
      leadTime: Number(weights?.leadTime) || 0,
    };

    const safeNum = (v: unknown, fallback = 0): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const prices = products.map((p) => safeNum(p.price, 0));
    const stocks = products.map((p) => safeNum(p.stock, 0));
    const mins = products.map((p) => safeNum(p.minQuantity, 1));
    const colorCounts = products.map((p) => p.colors?.length ?? 0);
    const leadTimes = products.map((p) => leadTimeProxy(p.stockStatus));

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minStock = Math.min(...stocks);
    const maxStock = Math.max(...stocks);
    const minMin = Math.min(...mins);
    const maxMin = Math.max(...mins);
    const minColors = Math.min(...colorCounts);
    const maxColors = Math.max(...colorCounts);
    const minLead = Math.min(...leadTimes);
    const maxLead = Math.max(...leadTimes);

    const totalWeight = Object.values(w).reduce((a, b) => a + b, 0) || 1;

    const scores = products.map((p, i) => {
      const verified = Boolean(p.supplier?.verified ?? p.supplier?.isVerified ?? false);
      const breakdown: Record<keyof ComparisonScoreWeights, number> = {
        price: normalizeLowerBetter(prices[i], minPrice, maxPrice) * w.price,
        stock: normalizeHigherBetter(stocks[i], minStock, maxStock) * w.stock,
        minQuantity: normalizeLowerBetter(mins[i], minMin, maxMin) * w.minQuantity,
        colorVariety: normalizeHigherBetter(colorCounts[i], minColors, maxColors) * w.colorVariety,
        verifiedSupplier: (verified ? 1 : 0.4) * w.verifiedSupplier,
        leadTime: normalizeLowerBetter(leadTimes[i], minLead, maxLead) * w.leadTime,
      };
      const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
      const normalized = Math.round((total / totalWeight) * 100);
      return {
        productId: p.id !== null && p.id !== undefined ? String(p.id) : `__idx_${i}`,
        total: Number.isFinite(normalized) ? normalized : 0,
        breakdown,
        isWinner: false,
        rank: 0,
      } as ProductScore;
    });

    // Determina vencedor + rank: sorted é cópia rasa, s já é referência em scores
    const sorted = [...scores].sort((a, b) => b.total - a.total);
    sorted.forEach((s, idx) => {
      s.rank = idx + 1;
      s.isWinner = idx === 0;
    });

    return scores;
  }, [products, weights]);
}

/**
 * Domain Calculators: Personalização
 *
 * Funções puras para cálculo de preços, sem side effects.
 */

import type {
  PriceTableInput,
  PriceTier,
  PriceCalculationParams,
  PriceCalculationResult,
  PrintArea,
} from './types';

// ============================================
// PRICE CALCULATION
// ============================================

/**
 * Calcula o preço total de personalização para uma tabela e parâmetros dados
 */
export function calculatePrice(
  table: PriceTableInput,
  params: PriceCalculationParams,
): PriceCalculationResult {
  const { quantity, colors, widthCm, heightCm } = params;

  // 1. Encontrar a faixa de preço correta
  const tier = findPriceTier(table.tiers, quantity);

  if (!tier) {
    throw new Error(`Nenhuma faixa de preço encontrada para quantidade ${quantity}`);
  }

  // 2. Calcular preço unitário base
  let unitPrice = tier.unitPrice;

  // 3. Ajustar por número de cores (se aplicável)
  if (table.priceByColor && colors && table.maxColors) {
    unitPrice = adjustPriceByColors(unitPrice, colors, table.maxColors);
  }

  // 4. Ajustar por área (se aplicável)
  if (table.priceByArea && widthCm && heightCm) {
    unitPrice = adjustPriceByArea(
      unitPrice,
      widthCm,
      heightCm,
      table.maxWidthCm,
      table.maxHeightCm,
    );
  }

  // 5. Calcular totais
  const subtotal = unitPrice * quantity;
  const grandTotal = subtotal + table.setupPrice + table.handlingPrice;

  // 6. Calcular economia vs primeira faixa
  const savings = calculateTierSavings(table.tiers, tier, unitPrice, quantity);

  // 7. Montar área máxima
  const maxArea: PrintArea | null =
    table.maxWidthCm && table.maxHeightCm
      ? {
          widthCm: table.maxWidthCm,
          heightCm: table.maxHeightCm,
          areaCm2: table.maxWidthCm * table.maxHeightCm,
        }
      : null;

  return {
    tableId: table.id,
    tableCode: table.tableCodeOption,
    techniqueName: table.techniqueName,
    quantity,
    tierUsed: tier.tier,
    unitPrice,
    subtotal,
    setupPrice: table.setupPrice,
    handlingPrice: table.handlingPrice,
    grandTotal,
    savings,
    slaDays: tier.slaDays,
    maxColors: table.maxColors,
    maxArea,
  };
}

/**
 * Encontra a faixa de preço apropriada para uma quantidade
 */
export function findPriceTier(tiers: PriceTier[], quantity: number): PriceTier | null {
  if (tiers.length === 0) return null;

  // Ordenar por quantidade mínima
  const sortedTiers = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

  // Encontrar a maior faixa que a quantidade atinge
  let selectedTier = sortedTiers[0];

  for (const tier of sortedTiers) {
    if (quantity >= tier.minQuantity) {
      selectedTier = tier;
    } else {
      break;
    }
  }

  return selectedTier;
}

/**
 * Ajusta preço baseado no número de cores
 * Se o cliente precisa de mais cores que o máximo da tabela, aplica proporcional
 */
export function adjustPriceByColors(
  basePrice: number,
  requestedColors: number,
  tableMaxColors: number,
): number {
  if (requestedColors <= tableMaxColors) {
    return basePrice;
  }

  // Preço proporcional para cores extras
  const colorFactor = requestedColors / tableMaxColors;
  return basePrice * colorFactor;
}

/**
 * Ajusta preço baseado na área
 * Se a área excede o máximo, aplica proporcional
 */
export function adjustPriceByArea(
  basePrice: number,
  requestedWidth: number,
  requestedHeight: number,
  maxWidth: number | null,
  maxHeight: number | null,
): number {
  if (!maxWidth || !maxHeight) return basePrice;

  const requestedArea = requestedWidth * requestedHeight;
  const maxArea = maxWidth * maxHeight;

  if (requestedArea <= maxArea) {
    return basePrice;
  }

  // Preço proporcional para área extra
  const areaFactor = requestedArea / maxArea;
  return basePrice * areaFactor;
}

/**
 * Calcula economia comparado à primeira faixa (interno)
 */
function calculateTierSavings(
  tiers: PriceTier[],
  _currentTier: PriceTier,
  currentUnitPrice: number,
  quantity: number,
): PriceCalculationResult['savings'] {
  if (tiers.length === 0) return undefined;

  const firstTier = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity)[0];
  const firstTierPrice = firstTier.unitPrice;

  const savingsPerUnit = firstTierPrice - currentUnitPrice;

  if (savingsPerUnit <= 0) return undefined;

  const totalSavings = savingsPerUnit * quantity;
  const percentOff = (savingsPerUnit / firstTierPrice) * 100;

  return {
    perUnit: savingsPerUnit,
    total: totalSavings,
    percentOff: Math.round(percentOff),
  };
}

/**
 * Calcula economia entre dois preços unitários (exportada)
 */
export function calculateSavings(
  originalUnitPrice: number,
  discountedUnitPrice: number,
  quantity: number,
): { perUnit: number; total: number; percentOff: number } {
  const perUnit = originalUnitPrice - discountedUnitPrice;
  const total = perUnit * quantity;
  const percentOff = originalUnitPrice > 0 ? Math.round((perUnit / originalUnitPrice) * 100) : 0;

  return { perUnit, total, percentOff };
}

// ============================================
// QUANTITY HELPERS
// ============================================

/**
 * Retorna a quantidade mínima de uma lista de faixas
 */
export function getMinimumQuantity(tiers: PriceTier[]): number {
  if (tiers.length === 0) return 1;

  return Math.min(...tiers.map((t) => t.minQuantity));
}

/**
 * Retorna a quantidade máxima explícita (ou null se ilimitado)
 */
export function getMaximumQuantity(tiers: PriceTier[]): number | null {
  if (tiers.length === 0) return null;

  const lastTier = [...tiers].sort((a, b) => b.minQuantity - a.minQuantity)[0];
  return lastTier.maxQuantity;
}

/**
 * Sugere a próxima faixa de quantidade para economia
 */
export function suggestNextTier(
  tiers: PriceTier[],
  currentQuantity: number,
): { quantity: number; savingsPercent: number } | null {
  const currentTier = findPriceTier(tiers, currentQuantity);
  if (!currentTier) return null;

  const sortedTiers = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  const currentIndex = sortedTiers.findIndex((t) => t.tier === currentTier.tier);

  if (currentIndex === -1 || currentIndex >= sortedTiers.length - 1) {
    return null;
  }

  const nextTier = sortedTiers[currentIndex + 1];
  const savingsPercent =
    ((currentTier.unitPrice - nextTier.unitPrice) / currentTier.unitPrice) * 100;

  return {
    quantity: nextTier.minQuantity,
    savingsPercent: Math.round(savingsPercent),
  };
}

// ============================================
// MULTI-TECHNIQUE CALCULATION
// ============================================

/**
 * Calcula preço para múltiplas técnicas (gravação em várias posições)
 */
export function calculateMultiTechniquePrice(calculations: PriceCalculationResult[]): {
  subtotal: number;
  totalSetup: number;
  totalHandling: number;
  grandTotal: number;
  totalSavings: number;
} {
  const subtotal = calculations.reduce((sum, c) => sum + c.subtotal, 0);
  const totalSetup = calculations.reduce((sum, c) => sum + c.setupPrice, 0);
  const totalHandling = calculations.reduce((sum, c) => sum + c.handlingPrice, 0);
  const totalSavings = calculations.reduce((sum, c) => sum + (c.savings?.total ?? 0), 0);

  return {
    subtotal,
    totalSetup,
    totalHandling,
    grandTotal: subtotal + totalSetup + totalHandling,
    totalSavings,
  };
}

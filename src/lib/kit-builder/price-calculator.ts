/**
 * Kit Builder - Price Calculator
 * CÃ¡lculos de preÃ§o para kits
 */

import type { KitItem, KitBox, KitPersonalization } from './types';

// ============================================
// CÃLCULOS DE PREÃ‡O
// ============================================

/**
 * Calcula o preÃ§o total da caixa
 */
export function calculateBoxPrice(box: KitBox | null, quantity: number = 1): number {
  if (!box) return 0;
  return box.price * quantity;
}

/**
 * Calcula o preÃ§o total dos itens
 */
export function calculateItemsPrice(items: KitItem[]): number {
  return items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);
}

/**
 * Calcula o preÃ§o estimado de personalizaÃ§Ã£o
 */
export function calculatePersonalizationPrice(
  personalization: KitPersonalization,
  items: KitItem[],
  quantity: number = 1,
): number {
  let total = 0;

  // PersonalizaÃ§Ã£o da caixa
  if (personalization.box.enabled && personalization.box.estimatedPrice) {
    total += personalization.box.estimatedPrice * quantity;
  }

  // PersonalizaÃ§Ã£o dos itens
  items.forEach((item) => {
    const itemPersonalization = personalization.items[item.id];
    if (itemPersonalization?.enabled && itemPersonalization.estimatedPrice) {
      total += itemPersonalization.estimatedPrice * item.quantity * quantity;
    }
  });

  return total;
}

/**
 * Calcula o preÃ§o total do kit
 */
export function calculateTotalKitPrice(
  box: KitBox | null,
  items: KitItem[],
  personalization: KitPersonalization,
  kitQuantity: number = 1,
): {
  boxPrice: number;
  itemsPrice: number;
  personalizationPrice: number;
  subtotal: number;
  total: number;
  unitPrice: number;
} {
  const boxPrice = calculateBoxPrice(box, kitQuantity);
  const itemsPricePerKit = calculateItemsPrice(items);
  const itemsPrice = itemsPricePerKit * kitQuantity;
  const personalizationPrice = calculatePersonalizationPrice(personalization, items, kitQuantity);

  const subtotal = boxPrice + itemsPrice;
  const total = subtotal + personalizationPrice;
  const unitPrice = kitQuantity > 0 ? total / kitQuantity : 0;

  return {
    boxPrice,
    itemsPrice,
    personalizationPrice,
    subtotal,
    total,
    unitPrice,
  };
}

/**
 * Calcula economia em relaÃ§Ã£o Ã  compra individual
 */
export function calculateSavings(
  kitPrice: number,
  individualItemsPrice: number,
): {
  amount: number;
  percent: number;
} {
  const amount = individualItemsPrice - kitPrice;
  const percent = individualItemsPrice > 0 ? (amount / individualItemsPrice) * 100 : 0;

  return {
    amount: Math.max(0, amount),
    percent: Math.max(0, percent),
  };
}

// ============================================
// FORMATAÃ‡ÃƒO
// ============================================

// Import + re-export from centralized format module
import { formatCurrency } from '@/lib/format';
export { formatCurrency };

/**
 * Formata preÃ§o por unidade
 */
export function formatUnitPrice(total: number, quantity: number): string {
  if (quantity === 0) return formatCurrency(0);
  return `${formatCurrency(total / quantity)}/un`;
}

// ============================================
// BREAKDOWN DO PREÃ‡O
// ============================================

export interface PriceBreakdownItem {
  label: string;
  quantity?: number;
  unitPrice: number;
  totalPrice: number;
  isPersonalization?: boolean;
}

/**
 * Gera breakdown detalhado do preÃ§o
 */
export function generatePriceBreakdown(
  box: KitBox | null,
  items: KitItem[],
  personalization: KitPersonalization,
  kitQuantity: number = 1,
): PriceBreakdownItem[] {
  const breakdown: PriceBreakdownItem[] = [];

  // Caixa
  if (box) {
    breakdown.push({
      label: `Caixa: ${box.name}`,
      quantity: kitQuantity,
      unitPrice: box.price,
      totalPrice: box.price * kitQuantity,
    });

    // PersonalizaÃ§Ã£o da caixa
    if (personalization.box.enabled && personalization.box.estimatedPrice) {
      breakdown.push({
        label: `â†³ GravaÃ§Ã£o: ${personalization.box.techniqueName || 'PersonalizaÃ§Ã£o'}`,
        quantity: kitQuantity,
        unitPrice: personalization.box.estimatedPrice,
        totalPrice: personalization.box.estimatedPrice * kitQuantity,
        isPersonalization: true,
      });
    }
  }

  // Itens
  items.forEach((item) => {
    const totalQty = item.quantity * kitQuantity;
    breakdown.push({
      label: item.name,
      quantity: totalQty,
      unitPrice: item.price,
      totalPrice: item.price * totalQty,
    });

    // PersonalizaÃ§Ã£o do item
    const itemPersonalization = personalization.items[item.id];
    if (itemPersonalization?.enabled && itemPersonalization.estimatedPrice) {
      breakdown.push({
        label: `â†³ GravaÃ§Ã£o: ${itemPersonalization.techniqueName || 'PersonalizaÃ§Ã£o'}`,
        quantity: totalQty,
        unitPrice: itemPersonalization.estimatedPrice,
        totalPrice: itemPersonalization.estimatedPrice * totalQty,
        isPersonalization: true,
      });
    }
  });

  return breakdown;
}

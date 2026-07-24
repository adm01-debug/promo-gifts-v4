/**
 * Kit Builder - Price Calculator
 * Cálculos de preço para kits
 */

import type { KitItem, KitBox, KitPersonalization } from './types';

// ============================================
// CÁLCULOS DE PREÇO
// ============================================

/**
 * Calcula o preço total da caixa
 */
export function calculateBoxPrice(box: KitBox | null, quantity = 1): number {
  if (!box) return 0;
  return box.price * quantity;
}

/**
 * Calcula o preço total dos itens
 */
export function calculateItemsPrice(items: KitItem[]): number {
  return items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);
}

/**
 * Calcula o preço estimado de personalização
 */
export function calculatePersonalizationPrice(
  personalization: KitPersonalization,
  items: KitItem[],
  quantity = 1,
): number {
  let total = 0;

  // Personalização da caixa
  if (personalization.box.enabled && personalization.box.estimatedPrice) {
    total += personalization.box.estimatedPrice * quantity;
  }

  // Personalização dos itens
  items.forEach((item) => {
    const itemPersonalization = personalization.items[item.id];
    if (itemPersonalization?.enabled && itemPersonalization.estimatedPrice) {
      total += itemPersonalization.estimatedPrice * item.quantity * quantity;
    }
  });

  return total;
}

/**
 * Calcula o preço total do kit
 */
export function calculateTotalKitPrice(
  box: KitBox | null,
  items: KitItem[],
  personalization: KitPersonalization,
  kitQuantity = 1,
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
 * Calcula economia em relação à compra individual
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
// FORMATAÇÃO
// ============================================

// Import + re-export from centralized format module
import { formatCurrency } from '@/lib/format';
export { formatCurrency };

/**
 * Formata preço por unidade
 */
export function formatUnitPrice(total: number, quantity: number): string {
  if (quantity === 0) return formatCurrency(0);
  return `${formatCurrency(total / quantity)}/un`;
}

// ============================================
// BREAKDOWN DO PREÇO
// ============================================

export interface PriceBreakdownItem {
  label: string;
  quantity?: number;
  unitPrice: number;
  totalPrice: number;
  isPersonalization?: boolean;
}

/**
 * Gera breakdown detalhado do preço
 */
export function generatePriceBreakdown(
  box: KitBox | null,
  items: KitItem[],
  personalization: KitPersonalization,
  kitQuantity = 1,
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

    // Personalização da caixa
    if (personalization.box.enabled && personalization.box.estimatedPrice) {
      breakdown.push({
        label: `↳ Gravação: ${personalization.box.techniqueName || 'Personalização'}`,
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

    // Personalização do item
    const itemPersonalization = personalization.items[item.id];
    if (itemPersonalization?.enabled && itemPersonalization.estimatedPrice) {
      breakdown.push({
        label: `↳ Gravação: ${itemPersonalization.techniqueName || 'Personalização'}`,
        quantity: totalQty,
        unitPrice: itemPersonalization.estimatedPrice,
        totalPrice: itemPersonalization.estimatedPrice * totalQty,
        isPersonalization: true,
      });
    }
  });

  return breakdown;
}

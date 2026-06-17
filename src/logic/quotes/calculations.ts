/**
 * Lógica pura de cálculos para o módulo de Orçamentos.
 * Segue os princípios de Imutabilidade e SRP (Single Responsibility Principle).
 */

export interface QuoteItemCalculationParams {
  quantity: number;
  unitPrice: number;
  personalizations?: Array<{ total_cost?: number }>;
}

/**
 * Utilitário para arredondamento monetário de 2 casas decimais (Half-up).
 */
export const round2 = (n: number | null | undefined): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
};

/**
 * Calcula o total de personalizações de um item.
 */
export const calculateItemPersonalizationTotal = (
  item: Pick<QuoteItemCalculationParams, 'personalizations'>,
): number => {
  return (item.personalizations ?? []).reduce((sum, p) => sum + (p.total_cost || 0), 0);
};

/**
 * Calcula o total bruto de um item (quantidade * preço + gravações) com arredondamento.
 */
export const calculateItemTotal = (item: QuoteItemCalculationParams): number => {
  return round2(item.quantity * item.unitPrice + calculateItemPersonalizationTotal(item));
};

/**
 * Calcula o subtotal de uma lista de itens com arredondamento.
 */
export const calculateSubtotal = (items: QuoteItemCalculationParams[]): number => {
  if (!items || !Array.isArray(items)) return 0;
  return round2(items.reduce((sum, item) => sum + calculateItemTotal(item), 0));
};

/**
 * Aplica markup de negociação a um valor base com arredondamento.
 */
export const applyMarkup = (baseValue: number, markupPercent: number): number => {
  const safeMarkup = Math.min(50, Math.max(0, markupPercent || 0));
  if (safeMarkup <= 0) return round2(baseValue);
  return round2(baseValue * (1 + safeMarkup / 100));
};

/**
 * Calcula o valor absoluto do desconto com arredondamento.
 */
export const calculateDiscountAmount = (
  subtotal: number,
  discountType: 'percent' | 'amount',
  discountValue: number,
): number => {
  const safeValue = Math.max(0, discountValue || 0);
  if (discountType === 'percent') {
    return round2((subtotal || 0) * (safeValue / 100));
  }
  return round2(safeValue);
};

/**
 * Calcula o percentual de desconto real sobre o subtotal original (sem markup).
 * Essencial para fluxos de aprovação de alçada com arredondamento.
 */
export const calculateRealDiscountPercent = (
  realSubtotal: number,
  presentedSubtotal: number,
  discountAmount: number,
): number => {
  if (realSubtotal <= 0) return 0;
  const finalBeforeShipping = Math.max(0, presentedSubtotal - discountAmount);
  // SSOT: Arredondamento para 2 casas decimais no percentual
  return round2(((realSubtotal - finalBeforeShipping) / realSubtotal) * 100);
};

/**
 * quoteHelpers — Cálculos e payloads reutilizáveis de orçamentos
 */
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { Quote, QuoteItem } from '@/hooks/quotes/quoteTypes';

/**
 * Hard limit on negotiation markup (%). Attempting to exceed this is a user
 * error — we throw instead of silently clamping so the UI can show a clear
 * validation message.
 * BUG-NEW-03 FIX: previously Math.min(50,...) clamped silently, causing
 * persisted totals to differ from what the user entered with no error shown.
 */
const MARKUP_MAX_PERCENT = 50;

/** Half-up rounding to 2 decimals — SSOT for monetary persistence */
export const round2 = (n: number | null | undefined): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
};

export function validateDiscount(
  quote: Partial<Quote>,
  totals: { subtotal: number; discountAmount: number },
) {
  if (quote.discount_percent && (quote.discount_percent < 0 || quote.discount_percent > 100)) {
    throw new Error('Desconto em porcentagem deve estar entre 0% e 100%');
  }
  if (totals.discountAmount < 0) {
    throw new Error('O valor do desconto não pode ser negativo');
  }
  if (totals.discountAmount > totals.subtotal + 0.01) {
    throw new Error(
      `O desconto não pode exceder o subtotal (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.subtotal)})`,
    );
  }
}

export function calculateQuoteTotals(quote: Partial<Quote>, items: QuoteItem[]) {
  const realSubtotal = items.reduce((sum, item) => {
    const baseTotal = item.quantity * item.unit_price;
    const persTotal = (item.personalizations || []).reduce(
      (pSum, p) => pSum + (p.total_cost || 0),
      0,
    );
    return sum + baseTotal + persTotal;
  }, 0);

  const rawMarkup = quote.negotiation_markup_percent || 0;

  // BUG-NEW-03 FIX: previously used Math.min(50, ...) which silently clamped
  // values above 50% without any feedback to the user. Now throws explicitly
  // so the UI can show a proper validation message.
  if (rawMarkup > MARKUP_MAX_PERCENT) {
    throw new Error(
      `Margem de negociação não pode exceder ${MARKUP_MAX_PERCENT}%. Valor informado: ${rawMarkup}%.`,
    );
  }
  const markup = Math.max(0, rawMarkup);

  const subtotal = markup > 0 ? round2(realSubtotal * (1 + markup / 100)) : realSubtotal;

  const discountAmount = quote.discount_percent
    ? round2(subtotal * (quote.discount_percent / 100))
    : quote.discount_amount || 0;
  const shippingCostValue =
    quote.shipping_type === 'fob_pre' ? round2(quote.shipping_cost || 0) : 0;
  const total = round2(subtotal - discountAmount + shippingCostValue);

  const finalBeforeShipping = subtotal - discountAmount;
  const realDiscountPercent =
    realSubtotal > 0 ? round2(((realSubtotal - finalBeforeShipping) / realSubtotal) * 100) : 0;

  return {
    subtotal: round2(subtotal),
    realSubtotal: round2(realSubtotal),
    discountAmount: round2(discountAmount),
    total: round2(total),
    realDiscountPercent,
    markup,
  };
}

export function buildInsertPayload(
  quote: Partial<Quote>,
  userId: string,
  orgId: string | null,
  totals: { subtotal: number; discountAmount: number; total: number },
): TablesInsert<'quotes'> {
  validateDiscount(quote, totals);
  return {
    quote_number: quote.quote_number ?? '',
    client_id: quote.client_id || null,
    client_name: quote.client_name || '',
    client_email: quote.client_email || null,
    client_phone: quote.client_phone || null,
    client_company: quote.client_company || null,
    seller_id: userId,
    organization_id: orgId,
    status: quote.status || 'draft',
    subtotal: round2(totals.subtotal),
    discount_percent: round2(quote.discount_percent || 0),
    discount_amount: round2(totals.discountAmount),
    total: round2(totals.total),
    negotiation_markup_percent: round2(quote.negotiation_markup_percent || 0),
    payment_method: quote.payment_method || null,
    payment_terms: quote.payment_terms || null,
    delivery_time: quote.delivery_time || null,
    shipping_type: quote.shipping_type || null,
    shipping_cost: round2(quote.shipping_cost || 0),
    notes: quote.notes || null,
    internal_notes: quote.internal_notes || null,
    valid_until: quote.valid_until || null,
  };
}

export function buildUpdatePayload(
  quote: Partial<Quote>,
  totals: { subtotal: number; discountAmount: number; total: number },
): TablesUpdate<'quotes'> {
  validateDiscount(quote, totals);
  return {
    client_id: quote.client_id || null,
    client_name: quote.client_name || '',
    client_email: quote.client_email || null,
    client_phone: quote.client_phone || null,
    client_company: quote.client_company || null,
    status: quote.status,
    subtotal: round2(totals.subtotal),
    discount_percent: round2(quote.discount_percent || 0),
    discount_amount: round2(totals.discountAmount),
    total: round2(totals.total),
    negotiation_markup_percent: round2(quote.negotiation_markup_percent || 0),
    payment_method: quote.payment_method || null,
    payment_terms: quote.payment_terms || null,
    delivery_time: quote.delivery_time || null,
    shipping_type: quote.shipping_type || null,
    shipping_cost: round2(quote.shipping_cost || 0),
    notes: quote.notes || null,
    internal_notes: quote.internal_notes || null,
    valid_until: quote.valid_until || null,
    updated_at: new Date().toISOString(),
  };
}

export function buildItemsInsertPayload(
  items: QuoteItem[],
  quoteId: string,
): TablesInsert<'quote_items'>[] {
  return items.map((item, index) => ({
    quote_id: quoteId,
    product_id: item.product_id,
    product_name: item.product_name,
    product_sku: item.product_sku,
    product_image_url: item.product_image_url,
    quantity: item.quantity,
    unit_price: round2(item.unit_price),
    subtotal: round2(item.unit_price * item.quantity),
    color_name: item.color_name,
    color_hex: item.color_hex,
    size_code: item.size_code || null,
    gender: item.gender || null,
    notes: item.notes,
    sort_order: index,
    kit_group_id: item.kit_group_id || null,
    kit_name: item.kit_name || null,
    price_confirmed_at: item.price_confirmed_at ?? null,
    price_updated_at: item.price_updated_at ?? null,
    price_freshness_threshold_days: item.price_freshness_threshold_days ?? null,
    bitrix_product_id:
      item.bitrix_product_id === null || item.bitrix_product_id === undefined
        ? null
        : String(item.bitrix_product_id),
  }));
}

export function buildPersonalizationsInsertPayload(
  personalizations: NonNullable<QuoteItem['personalizations']>,
  quoteItemId: string,
): TablesInsert<'quote_item_personalizations'>[] {
  return personalizations.map((p) => ({
    quote_item_id: quoteItemId,
    technique_id: p.technique_id || null,
    technique_name: p.technique_name || null,
    location_code: p.location_code || null,
    location_name: p.location_name || null,
    personalized_quantity: p.personalized_quantity || null,
    colors_count: p.colors_count || 1,
    positions_count: p.positions_count || 1,
    area_cm2: p.area_cm2,
    width_cm: p.width_cm,
    height_cm: p.height_cm,
    setup_cost: round2(p.setup_cost || 0),
    unit_cost: round2(p.unit_cost || 0),
    total_cost: round2(p.total_cost || 0),
    notes: p.notes,
  }));
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  expired: 'Expirado',
};

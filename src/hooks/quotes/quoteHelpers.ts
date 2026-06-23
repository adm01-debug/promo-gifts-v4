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

/**
 * Markup persistido sempre dentro de [0, MARKUP_MAX_PERCENT].
 * O banco agora REJEITA (CHECK valid_negotiation_markup_range) markup fora de faixa em vez de
 * clampar em silêncio; calculateQuoteTotals já lança erro acima do teto, mas markup negativo
 * escapava e seria gravado cru. Este clamp garante que o valor enviado nunca dispare o CHECK
 * e que o markup gravado seja exatamente o usado no cálculo.
 */
const clampMarkup = (v: number | null | undefined): number =>
  round2(Math.max(0, Math.min(MARKUP_MAX_PERCENT, v || 0)));

export function validateDiscount(
  quote: Partial<Quote>,
  totals: { subtotal: number; discountAmount: number },
) {
  if (quote.discount_percent && (quote.discount_percent < 0 || quote.discount_percent > 100)) {
    throw new Error('Desconto em porcentagem deve estar entre 0% e 100%');
  }
  // BUG-008: NaN comparisons always return false, so a NaN discountAmount would
  // silently pass the checks below and be persisted as NaN. Guard first.
  if (!Number.isFinite(totals.discountAmount)) {
    throw new Error(
      `Valor de desconto inválido: ${totals.discountAmount}. Recarregue a página e tente novamente.`,
    );
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

  // BUG-NAN-GUARD FIX: NaN item prices (data corruption, API response gap) cause
  // realSubtotal to be NaN, which then silently propagates through totals → DB.
  // round2() would return 0 for NaN inputs (hiding the bug), so we throw explicitly
  // so the UI can surface a clear error instead of persisting wrong totals.
  if (!Number.isFinite(realSubtotal)) {
    throw new Error(
      `Subtotal dos itens inválido: ${realSubtotal}. Verifique se todos os itens possuem preço e quantidade válidos.`,
    );
  }

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
  // FIX-E10: clamp shipping_cost to ≥0 — negative freight makes no business sense
  const shippingCostValue =
    quote.shipping_type === 'fob_pre' ? round2(Math.max(0, quote.shipping_cost || 0)) : 0;
  const total = round2(subtotal - discountAmount + shippingCostValue);

  const finalBeforeShipping = subtotal - discountAmount;
  // Negative value is valid: means markup > apparent discount (seller has margin).
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
): TablesInsert<'quotes'> & { contact_id: string | null } {
  // contact_id: real column in `quotes` absent from the stale generated types.
  // The intersection keeps the payload typed without TS2353.
  validateDiscount(quote, totals);

  // QBP-03 FIX (2026-06-22): Manter SSOT de desconto — apenas um dos dois campos
  // pode ser não-zero ao mesmo tempo. Antes, discount_amount calculado (subtotal *
  // discount_percent / 100) era gravado mesmo quando discount_percent estava ativo,
  // fazendo ambos os campos ficarem não-zero e disparando BUG-003 warning em TODOS
  // os carregamentos — tornando o warning inútil como detector de corrupção real.
  const usingPercent = (quote.discount_percent ?? 0) > 0;

  return {
    quote_number: quote.quote_number ?? '',
    client_id: quote.client_id || null,
    client_name: quote.client_name || '',
    client_email: quote.client_email || null,
    client_phone: quote.client_phone || null,
    client_company: quote.client_company || null,
    client_cnpj: quote.client_cnpj || null,
    contact_id: quote.contact_id ?? null,
    seller_id: userId,
    organization_id: orgId,
    status: quote.status || 'draft',
    subtotal: round2(totals.subtotal),
    discount_percent: usingPercent ? round2(quote.discount_percent || 0) : 0,
    discount_amount: usingPercent ? 0 : round2(totals.discountAmount),
    total: round2(totals.total),
    negotiation_markup_percent: clampMarkup(quote.negotiation_markup_percent),
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
): TablesUpdate<'quotes'> & { contact_id: string | null } {
  // contact_id must always be present in the patch so update_quote_transactional
  // (which checks `_quote_patch ? 'contact_id'`) can clear the field when needed.
  validateDiscount(quote, totals);

  // QBP-03 FIX: ver buildInsertPayload — manter SSOT de desconto.
  const usingPercent = (quote.discount_percent ?? 0) > 0;

  return {
    client_id: quote.client_id || null,
    client_name: quote.client_name || '',
    client_email: quote.client_email || null,
    client_phone: quote.client_phone || null,
    client_company: quote.client_company || null,
    client_cnpj: quote.client_cnpj || null,
    contact_id: quote.contact_id ?? null,
    status: quote.status,
    subtotal: round2(totals.subtotal),
    discount_percent: usingPercent ? round2(quote.discount_percent || 0) : 0,
    discount_amount: usingPercent ? 0 : round2(totals.discountAmount),
    total: round2(totals.total),
    negotiation_markup_percent: clampMarkup(quote.negotiation_markup_percent),
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
  // FIX-E06: silently drop items with quantity < 1 before persisting; they indicate
  // a UI state that was never cleared and would create zero-value rows in the DB.
  const validItems = items.filter((item) => (item.quantity ?? 0) >= 1);
  return validItems.map((item, index) => ({
    quote_id: quoteId,
    product_id: item.product_id,
    product_name: item.product_name,
    product_sku: item.product_sku,
    product_image_url: item.product_image_url,
    quantity: item.quantity,
    unit_price: round2(item.unit_price),
    // BUG-B FIX: include personalization costs in item subtotal so that external
    // systems (N8N, Bitrix24, reports) receive correct per-item totals.
    subtotal: round2(
      item.unit_price * item.quantity +
        (item.personalizations || []).reduce((s, p) => s + (p.total_cost || 0), 0),
    ),
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
      item.bitrix_product_id !== null && item.bitrix_product_id !== undefined
        ? String(item.bitrix_product_id)
        : null,
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

/**
 * Mapa completo de todos os status possíveis de orçamento.
 * Sincronizado com o CHECK valid_quote_status no banco:
 * draft | pending | pending_approval | sent | viewed |
 * approved | converted | rejected | expired | cancelled
 *
 * FIX: versão anterior omitia pending_approval, viewed, converted e cancelled,
 * fazendo a UI exibir o valor cru do banco para esses status.
 */
export const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  pending_approval: 'Aguardando Aprovação',
  sent: 'Enviado',
  viewed: 'Visualizado',
  approved: 'Aprovado',
  converted: 'Convertido',
  rejected: 'Rejeitado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
};

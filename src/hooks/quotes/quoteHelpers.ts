/**
 * quoteHelpers — Cálculos e payloads reutilizáveis de orçamentos
 */
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { Quote, QuoteItem } from '@/hooks/quotes/quoteTypes';
import type { QuoteStatus } from '@/types/quote';

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
 * Clamp markup to [0, ∞) — negative markup makes no semantic sense and would
 * slip past calculateQuoteTotals (which only throws for > MARKUP_MAX_PERCENT).
 * The upper bound is intentionally NOT enforced here: calculateQuoteTotals
 * already throws before buildInsertPayload is reached, and the DB CHECK
 * (valid_negotiation_markup_range) acts as the final guard. Capping silently
 * at 50 here would persist a different value than what the user entered, which
 * is a worse outcome than letting the DB reject it with an explicit error.
 */
const clampMarkup = (v: number | null | undefined): number => round2(Math.max(0, v || 0));

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
  // realDiscountPercent NÃO é clampado: um valor negativo é válido e significa que
  // o markup absorveu o desconto aparente (cliente paga acima do subtotal real), logo
  // não há concessão real a validar na alçada. A UI (calculateRealDiscountPercent) é
  // responsável por exibir negativos como "sem desconto efetivo". Contrato coberto por
  // QuoteFullFlowIntegration (-4.5) e quotePersistence (0 natural).
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
): TablesInsert<'quotes'> & { contact_id?: string | null } {
  // contact_id: coluna real de `quotes` ausente do types.ts gerado (stale). A intersecção
  // mantém o payload tipado e evita TS2353. Ver src/lib/supabase-untyped.ts.
  validateDiscount(quote, totals);
  return {
    quote_number: quote.quote_number ?? '',
    client_id: quote.client_id || null,
    // contact_id MUST be emitted: create_quote_transactional reads _quote->>'contact_id'
    // (migration 20260620120000). Omitting it silently drops the CRM contact on every quote.
    contact_id: quote.contact_id ?? null,
    client_name: quote.client_name || '',
    client_email: quote.client_email || null,
    client_phone: quote.client_phone || null,
    client_company: quote.client_company || null,
    client_cnpj: quote.client_cnpj || null,
    seller_id: userId,
    organization_id: orgId,
    status: quote.status || 'draft',
    subtotal: round2(totals.subtotal),
    discount_percent: round2(quote.discount_percent || 0),
    discount_amount: round2(totals.discountAmount),
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
): TablesUpdate<'quotes'> & { contact_id?: string | null } {
  // contact_id: idem buildInsertPayload — coluna real ausente do types.ts gerado (stale).
  validateDiscount(quote, totals);
  return {
    client_id: quote.client_id || null,
    // contact_id MUST be emitted: update_quote_transactional gates on _quote_patch ? 'contact_id'
    // (migration 20260620140000). Omitting it makes contact changes/clears silently ignored.
    contact_id: quote.contact_id ?? null,
    client_name: quote.client_name || '',
    client_email: quote.client_email || null,
    client_phone: quote.client_phone || null,
    client_company: quote.client_company || null,
    client_cnpj: quote.client_cnpj || null,
    status: quote.status,
    subtotal: round2(totals.subtotal),
    discount_percent: round2(quote.discount_percent || 0),
    discount_amount: round2(totals.discountAmount),
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
      item.bitrix_product_id !== null && item.bitrix_product_id !== undefined
        ? String(item.bitrix_product_id)
        : null,
  }));
}

export function buildPersonalizationsInsertPayload(
  personalizations: NonNullable<QuoteItem['personalizations']>,
  quoteItemId: string,
): TablesInsert<'quote_item_personalizations'>[] {
  return personalizations.map((p) => {
    if ((p.setup_cost ?? 0) < 0 || (p.unit_cost ?? 0) < 0 || (p.total_cost ?? 0) < 0) {
      throw new Error(
        `Custos de personalização não podem ser negativos (técnica: ${p.technique_name || p.technique_id || 'desconhecida'})`,
      );
    }
    return {
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
    };
  });
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
export const STATUS_LABELS: Record<QuoteStatus, string> = {
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

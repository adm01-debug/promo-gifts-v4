/**
 * quoteMarkup — Aplica a margem de negociação aos valores APRESENTADOS ao cliente.
 *
 * Contexto do bug: `calculateQuoteTotals` (quoteHelpers) já persiste
 * `subtotal`/`total` COM o `negotiation_markup_percent`, e a lista/kanban/
 * dashboard/WhatsApp exibem esses valores persistidos. Porém o PDF da proposta
 * (useQuoteViewData) e a página de visualização (QuoteViewPage) recalculavam a
 * partir dos `unit_price` reais, SEM markup — fazendo o cliente ver um total
 * menor que o registrado no sistema.
 *
 * Este helper reaplica o fator de markup nos itens exibidos, de modo que a soma
 * dos itens permaneça coerente com o subtotal/total apresentados. O PERCENTUAL
 * de markup nunca é exibido — apenas o seu efeito nos preços — conforme
 * `quoteTypes.ts` ("NUNCA exposto ao cliente").
 */
import { round2 } from './quoteHelpers';
import type { QuoteItem } from './quoteTypes';

/** Mesmo teto usado em quoteHelpers.calculateQuoteTotals / clampMarkup. */
const MARKUP_MAX_PERCENT = 50;

/** Fator multiplicativo (1 + markup/100), com o markup saneado para [0, 50]. */
export const negotiationMarkupFactor = (markupPercent?: number | null): number => {
  const pct = Math.max(0, Math.min(MARKUP_MAX_PERCENT, markupPercent || 0));
  return 1 + pct / 100;
};

/**
 * Retorna uma cópia dos itens com `unit_price`, `subtotal` e os custos de
 * personalização multiplicados pelo fator de markup. É um no-op (retorna a mesma
 * referência) quando o markup é 0, preservando exatamente o comportamento atual
 * dos orçamentos sem margem.
 */
export function applyNegotiationMarkup(
  items: QuoteItem[],
  markupPercent?: number | null,
): QuoteItem[] {
  const factor = negotiationMarkupFactor(markupPercent);
  if (factor === 1) return items;
  return items.map((item) => ({
    ...item,
    unit_price: round2((item.unit_price || 0) * factor),
    subtotal: typeof item.subtotal === 'number' ? round2(item.subtotal * factor) : item.subtotal,
    personalizations: item.personalizations?.map((p) => ({
      ...p,
      setup_cost: typeof p.setup_cost === 'number' ? round2(p.setup_cost * factor) : p.setup_cost,
      unit_cost: typeof p.unit_cost === 'number' ? round2(p.unit_cost * factor) : p.unit_cost,
      total_cost: typeof p.total_cost === 'number' ? round2(p.total_cost * factor) : p.total_cost,
    })),
  }));
}

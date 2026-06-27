/**
 * QuoteTotalsSummary — Cartão editorial de totais (fechamento do orçamento).
 */
import { formatCurrency } from '@/lib/format';
import type { QuoteItem } from './QuoteItemsTable';

interface QuoteTotalsSummaryProps {
  items: QuoteItem[];
  discountPercent?: number;
  discountAmount?: number;
  shippingType?: string | null;
  shippingCost?: number | null;
}

export function QuoteTotalsSummary({
  items,
  discountPercent,
  discountAmount,
  shippingType,
  shippingCost,
}: QuoteTotalsSummaryProps) {
  const productSubtotal = items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const personalizationTotal = items.reduce((acc, item) => {
    return acc + (item.personalizations ?? []).reduce((pAcc, p) => pAcc + (p.total_cost ?? 0), 0);
  }, 0);
  const fullSubtotal = productSubtotal + personalizationTotal;
  const discountValue = discountPercent
    ? Math.round(fullSubtotal * (discountPercent / 100) * 100) / 100
    : discountAmount || 0;
  // Apenas 'fob_pre' (FOB Pré-negociado) tem custo repassado no orçamento.
  const shippingValue = shippingType === 'fob_pre' ? shippingCost || 0 : 0;
  const computedTotal = fullSubtotal - discountValue + shippingValue;
  const hasPersonalizations = personalizationTotal > 0;

  return (
    <div className="flex justify-end">
      <div className="w-full max-w-[420px] overflow-hidden rounded-xl border border-border/60 bg-card/40">
        <div className="space-y-2.5 px-5 py-4 text-[13px]">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Subtotal produtos</span>
            <span data-testid="summary-subtotal-products" className="tabular-nums text-foreground">
              {formatCurrency(productSubtotal)}
            </span>
          </div>
          {hasPersonalizations && (
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Personalização</span>
              <span data-testid="summary-personalization" className="tabular-nums text-foreground">
                {formatCurrency(personalizationTotal)}
              </span>
            </div>
          )}
          {discountValue > 0 && (
            <div className="flex items-baseline justify-between text-destructive">
              <span>Desconto{discountPercent ? ` (${discountPercent}%)` : ''}</span>
              <span data-testid="summary-discount" className="tabular-nums">
                −{formatCurrency(discountValue)}
              </span>
            </div>
          )}
          {shippingType && (
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Frete</span>
              <span className="text-right text-[12px] text-foreground/90">
                {shippingType === 'cif'
                  ? 'CIF — Cortesia'
                  : shippingType === 'fob'
                    ? 'FOB — Por conta do cliente'
                    : shippingType === 'fob_pre'
                      ? `FOB Pré-negociado (${formatCurrency(shippingCost || 0)})`
                      : formatCurrency(shippingCost || 0)}
              </span>
            </div>
          )}
        </div>
        <div className="border-t border-border/60 bg-muted/30 px-5 py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Total
            </span>
            <span
              data-testid="summary-total"
              className="font-display text-[26px] font-semibold tracking-tight tabular-nums text-primary"
            >
              {formatCurrency(computedTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

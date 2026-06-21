/**
 * QuoteTotalsSummary — Totals breakdown card for QuoteViewPage
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
  // 'fob' = FOB puro (frete por conta do cliente, sem cost no orçamento).
  const shippingValue = shippingType === 'fob_pre' ? shippingCost || 0 : 0;
  const computedTotal = fullSubtotal - discountValue + shippingValue;
  const hasPersonalizations = personalizationTotal > 0;

  return (
    <div className="flex justify-end">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border">
        <div className="space-y-2 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal produtos:</span>
            <span data-testid="summary-subtotal-products">{formatCurrency(productSubtotal)}</span>
          </div>
          {hasPersonalizations && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Personalização:</span>
              <span data-testid="summary-personalization">
                {formatCurrency(personalizationTotal)}
              </span>
            </div>
          )}
          {discountValue > 0 && (
            <div className="flex justify-between text-sm text-destructive">
              <span>Desconto{discountPercent ? ` (${discountPercent}%)` : ''}:</span>
              <span data-testid="summary-discount">-{formatCurrency(discountValue)}</span>
            </div>
          )}
          {shippingType && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Frete:</span>
              <span>
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
        <div className="border-t border-border bg-muted/50 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold">Total:</span>
            <span data-testid="summary-total" className="text-2xl font-bold text-primary">
              {formatCurrency(computedTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * QuoteTotalsSummary — Totals breakdown card for QuoteViewPage.
 * Tipografia via SSOT `quote-view-typography` (consistência com cliente/itens).
 */
import { formatCurrency } from '@/lib/format';
import type { QuoteItem } from './QuoteItemsTable';
import { qvSpacing, qvType } from './quote-view-typography';

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
    <aside aria-label="Resumo de totais" className="flex justify-end">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border">
        <dl className={`space-y-1.5 ${qvSpacing.summaryBody}`}>
          <div className={`flex justify-between ${qvType.summaryRow}`}>
            <dt className="text-muted-foreground">Subtotal produtos:</dt>
            <dd data-testid="summary-subtotal-products">{formatCurrency(productSubtotal)}</dd>
          </div>
          {hasPersonalizations && (
            <div className={`flex justify-between ${qvType.summaryRow}`}>
              <dt className="text-muted-foreground">Personalização:</dt>
              <dd data-testid="summary-personalization">{formatCurrency(personalizationTotal)}</dd>
            </div>
          )}
          {discountValue > 0 && (
            <div className={`flex justify-between text-destructive ${qvType.summaryRow}`}>
              <dt>Desconto{discountPercent ? ` (${discountPercent}%)` : ''}:</dt>
              <dd data-testid="summary-discount">-{formatCurrency(discountValue)}</dd>
            </div>
          )}
          {shippingType && (
            <div className={`flex justify-between ${qvType.summaryRow}`}>
              <dt className="text-muted-foreground">Frete:</dt>
              <dd>
                {shippingType === 'cif'
                  ? 'CIF — Cortesia'
                  : shippingType === 'fob'
                    ? 'FOB — Por conta do cliente'
                    : shippingType === 'fob_pre'
                      ? `FOB Pré-negociado (${formatCurrency(shippingCost || 0)})`
                      : formatCurrency(shippingCost || 0)}
              </dd>
            </div>
          )}
        </dl>
        <div className={`border-t border-border bg-muted/50 ${qvSpacing.summaryTotalBar}`}>
          <div className="flex items-baseline justify-between">
            <span className={qvType.totalLabel}>Total:</span>
            <span data-testid="summary-total" className={qvType.totalValue}>
              {formatCurrency(computedTotal)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}


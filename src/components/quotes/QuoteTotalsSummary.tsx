/**
 * QuoteTotalsSummary — Totals breakdown card for QuoteViewPage
 */
import { formatCurrency } from "@/lib/format";

function calcPersTotal(totalCost: number, qty: number): number {
  if (qty <= 0) return totalCost;
  const roundedUnit = Math.round((totalCost / qty) * 100) / 100;
  return Math.round(roundedUnit * qty * 100) / 100;
}

interface QuoteTotalsSummaryProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  discountPercent?: number;
  discountAmount?: number;
  shippingType?: string | null;
  shippingCost?: number | null;
}

export function QuoteTotalsSummary({ items, discountPercent, discountAmount, shippingType, shippingCost }: QuoteTotalsSummaryProps) {
  const productSubtotal = items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const personalizationTotal = items.reduce((acc, item) => {
    return acc + (item.personalizations || []).reduce(
      (pAcc: number, p: { total_cost?: number }) => pAcc + calcPersTotal(p.total_cost || 0, item.quantity), 0
    );
  }, 0);
  const fullSubtotal = productSubtotal + personalizationTotal;
  const discountValue = discountPercent
    ? Math.round(fullSubtotal * (discountPercent / 100) * 100) / 100
    : (discountAmount || 0);
  const shippingValue = (shippingType === "fob" || shippingType === "fob_pre")
    ? (shippingCost || 0) : 0;
  const computedTotal = fullSubtotal - discountValue + shippingValue;
  const hasPersonalizations = personalizationTotal > 0;

  return (
    <div className="flex justify-end">
      <div className="w-full max-w-sm rounded-lg border border-border overflow-hidden">
        <div className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal produtos:</span>
            <span data-testid="summary-subtotal-products">{formatCurrency(productSubtotal)}</span>
          </div>
          {hasPersonalizations && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Personalização:</span>
              <span data-testid="summary-personalization">{formatCurrency(personalizationTotal)}</span>
            </div>
          )}
          {discountValue > 0 && (
            <div className="flex justify-between text-sm text-destructive">
              <span>Desconto{discountPercent ? ` (${discountPercent}%)` : ""}:</span>
              <span data-testid="summary-discount">-{formatCurrency(discountValue)}</span>
            </div>
          )}
          {shippingType && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Frete:</span>
              <span>{
                shippingType === "cif" ? "CIF — Cortesia" :
                shippingType === "fob" && !shippingCost ? "FOB — Por conta do cliente" :
                (shippingType === "fob" || shippingType === "fob_pre") ? `FOB — Repassado ao cliente (${formatCurrency(shippingCost || 0)})` :
                formatCurrency(shippingCost || 0)
              }</span>
            </div>
          )}
        </div>
        <div className="bg-muted/50 border-t border-border px-4 py-3">
          <div className="flex justify-between items-baseline">
            <span className="font-bold text-lg">Total:</span>
            <span data-testid="summary-total" className="text-2xl font-bold text-primary">{formatCurrency(computedTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

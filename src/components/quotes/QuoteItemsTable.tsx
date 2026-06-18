/**
 * QuoteItemsTable — Items table with kit grouping for QuoteViewPage
 */
import React from 'react';
import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { QuoteItemDetailSheet } from './QuoteItemDetailSheet';
import { PriceFreshnessBadge } from '@/components/products/PriceFreshnessBadge';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Recalculate personalization total using rounded unit price to match UI display */
function calcPersTotal(totalCost: number, qty: number): number {
  if (qty <= 0) return totalCost;
  const roundedUnit = Math.round((totalCost / qty) * 100) / 100;
  return Math.round(roundedUnit * qty * 100) / 100;
}

export interface QuotePersonalization {
  id?: string;
  technique_name?: string | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  notes?: string | null;
  width_cm?: number | null;
  height_cm?: number | null;
  colors_count?: number | null;
}

export interface QuoteItem {
  id?: string;
  product_id?: string;
  product_name: string;
  product_sku?: string | null;
  product_image_url?: string | null;
  color_name?: string | null;
  color_hex?: string | null;
  quantity: number;
  unit_price: number;
  kit_group_id?: string | null;
  kit_name?: string | null;
  /** Optional: ISO timestamp from the external catalog (SSOT) for freshness badge. */
  price_updated_at?: string | null;
  /** Optional: per-product threshold (days) for the stale-price warning. */
  price_freshness_threshold_days?: number | null;
  notes?: string | null;
  personalizations?: QuotePersonalization[];
}

interface QuoteItemsTableProps {
  items: QuoteItem[];
}

export function QuoteItemsTable({ items }: QuoteItemsTableProps) {
  const hasPersonalizations = items.some(
    (item) => item.personalizations && item.personalizations.length > 0,
  );

  // Group items: kit groups first, then loose items
  const kitGroups = new Map<string, { name: string; items: QuoteItem[] }>();
  const looseItems: QuoteItem[] = [];

  items.forEach((item) => {
    if (item.kit_group_id && item.kit_name) {
      const group = kitGroups.get(item.kit_group_id) || { name: item.kit_name, items: [] };
      group.items.push(item);
      kitGroups.set(item.kit_group_id, group);
    } else {
      looseItems.push(item);
    }
  });

  const colCount = hasPersonalizations ? 6 : 5;

  const renderItemRow = (item: QuoteItem, index: number) => {
    const allPersonalizations = item.personalizations ?? [];
    const personalizationCost = allPersonalizations.reduce(
      (acc: number, p: QuotePersonalization) =>
        acc + calcPersTotal(p.total_cost ?? 0, item.quantity),
      0,
    );
    const itemTotal = item.quantity * item.unit_price + personalizationCost;

    return (
      <tr
        key={item.id || `item-${index}`}
        className={cn(
          'border-b border-border/50 transition-colors hover:bg-muted/40',
          index % 2 === 1 && 'bg-muted/20',
        )}
      >
        <td className="p-3">
          <div className="flex items-center gap-3">
            {item.product_image_url && (
              <img
                src={item.product_image_url}
                alt={item.product_name}
                className="h-16 w-16 rounded border border-border object-cover print:hidden"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            )}
            <div>
              {item.product_sku && (
                <span
                  className="mb-1 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold"
                  style={{
                    backgroundColor: item.color_hex ? `${item.color_hex}22` : undefined,
                    borderColor: item.color_hex || 'hsl(var(--border))',
                    color: item.color_hex || 'hsl(var(--foreground))',
                  }}
                >
                  {item.color_hex && (
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-border/50"
                      style={{ backgroundColor: item.color_hex }}
                    />
                  )}
                  {item.product_sku}
                  {item.color_name ? `-${item.color_name}` : ''}
                </span>
              )}
              <p className="font-medium">{item.product_name}</p>
            </div>
          </div>
        </td>

        {hasPersonalizations && (
          <td className="p-3">
            {allPersonalizations.length > 0 ? (
              <div className="space-y-1.5">
                {allPersonalizations.map((p, pIdx) => {
                  const notesRaw = p.notes ?? '';
                  const [locationPart, dimPart] = notesRaw.split(' | ');
                  const locationLabel = locationPart ? locationPart.split(' — ')[0] : null;
                  let dimLabel: string | null = null;
                  if (dimPart) {
                    dimLabel = dimPart.replace('cm', ' cm');
                  } else if (p.width_cm && p.height_cm) {
                    dimLabel = `${p.width_cm} × ${p.height_cm} cm`;
                  }
                  return (
                    <div key={pIdx} className={cn(pIdx > 0 && 'border-t border-border/30 pt-1.5')}>
                      <div className="bg-primary/8 inline-flex flex-col gap-0.5 rounded-md border border-primary/20 px-2 py-1.5">
                        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                          ✦ {p.technique_name}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {locationLabel && (
                            <span className="font-medium text-foreground/70">{locationLabel}</span>
                          )}
                          {dimLabel && (
                            <span className="font-medium text-foreground/80">{dimLabel}</span>
                          )}
                          <span>
                            {p.colors_count || 1} cor{(p.colors_count || 1) > 1 ? 'es' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </td>
        )}
        <td className="w-20 p-3 text-center text-sm font-semibold">{item.quantity}</td>
        <td className="w-28 p-3 text-left tabular-nums text-muted-foreground">
          <div className="flex flex-col gap-0.5">
            <span>
              {formatCurrency(
                item.unit_price +
                  allPersonalizations.reduce((sum: number, p: QuotePersonalization) => {
                    const pTotal = p.total_cost ?? 0;
                    return (
                      sum +
                      (item.quantity > 0 ? Math.round((pTotal / item.quantity) * 100) / 100 : 0)
                    );
                  }, 0),
              )}
            </span>
            <PriceFreshnessBadge
              priceUpdatedAt={item.price_updated_at}
              thresholdDays={item.price_freshness_threshold_days}
              variant="compact"
            />
          </div>
        </td>
        <td className="w-32 p-3 text-left text-base font-bold tabular-nums">
          {formatCurrency(itemTotal)}
        </td>
        <td className="p-3 text-center print:hidden">
          <QuoteItemDetailSheet
            item={{
              product_name: item.product_name,
              product_sku: item.product_sku ?? undefined,
              product_image_url: item.product_image_url ?? undefined,
              color_name: item.color_name ?? undefined,
              color_hex: item.color_hex ?? undefined,
              quantity: item.quantity,
              unit_price: item.unit_price,
              notes: typeof item.notes === 'string' ? item.notes : undefined,
              personalizations: item.personalizations?.map((p) => ({
                ...p,
                technique_name: p.technique_name ?? undefined,
                unit_cost: p.unit_cost ?? undefined,
                total_cost: p.total_cost ?? undefined,
                notes: p.notes ?? undefined,
                width_cm: p.width_cm ?? undefined,
                height_cm: p.height_cm ?? undefined,
                colors_count: p.colors_count ?? undefined,
              })),
            }}
          />
        </td>
      </tr>
    );
  };

  return (
    <div>
      <h3 className="mb-4 font-display font-semibold">Itens do Orçamento</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-primary/15">
              <th className="p-3 text-left text-sm font-semibold text-primary">Produto</th>
              {hasPersonalizations && (
                <th className="p-3 text-left text-sm font-semibold text-primary">Personalização</th>
              )}
              <th className="w-20 p-3 text-center text-sm font-semibold text-primary">Qtd</th>
              <th className="w-28 p-3 text-left text-sm font-semibold text-primary">Unitário</th>
              <th className="w-32 p-3 text-left text-sm font-semibold text-primary">Total</th>
              <th className="w-24 p-3 text-center text-sm font-semibold text-primary print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {[...kitGroups.entries()].map(([groupId, group]) => (
              <React.Fragment key={groupId}>
                <tr className="border-b border-border bg-accent/60">
                  <td colSpan={colCount} className="p-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-primary">Kit: {group.name}</span>
                      <Badge variant="outline" className="ml-1 text-xs">
                        {group.items.length} itens
                      </Badge>
                    </div>
                  </td>
                </tr>
                {group.items.map((item, idx) => renderItemRow(item, idx))}
              </React.Fragment>
            ))}
            {kitGroups.size > 0 && looseItems.length > 0 && (
              <tr className="border-b border-border bg-muted/30">
                <td colSpan={colCount} className="p-2 px-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Itens Avulsos
                  </span>
                </td>
              </tr>
            )}
            {looseItems.map((item, idx) => renderItemRow(item, idx))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

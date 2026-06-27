/**
 * QuoteItemsTable — Items table with kit grouping for QuoteViewPage
 */
import React from 'react';
import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { QuoteItemDetailSheet } from './QuoteItemDetailSheet';
import { PriceFreshnessBadge } from '@/components/products/PriceFreshnessBadge';
import { formatCurrency } from '@/lib/format';


const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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
    const allPersonalizations = item.personalizations || [];
    // BUG-048b: use p.total_cost directly — avoids round(round(x/n)*n) ≠ x
    const personalizationCost = allPersonalizations.reduce(
      (acc: number, p: QuotePersonalization) => acc + (p.total_cost ?? 0),
      0,
    );
    const itemTotal = round2(item.quantity * item.unit_price + personalizationCost);

    return (
      <tr
        key={item.id || `item-${index}`}
        className="border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/30"
      >
        <td className="p-4">
          <div className="flex items-center gap-4">
            {item.product_image_url && (
              <img
                src={item.product_image_url}
                alt={item.product_name}
                className="h-16 w-16 shrink-0 rounded-lg border border-border/50 bg-muted/30 object-cover print:hidden"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            )}
            <div className="min-w-0">
              {item.product_sku && (
                <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {item.color_hex && (
                    <span
                      className="h-2 w-2 rounded-full ring-1 ring-border/60"
                      style={{ backgroundColor: item.color_hex }}
                    />
                  )}
                  {item.product_sku}
                  {item.color_name ? ` · ${item.color_name}` : ''}
                </span>
              )}
              <p className="font-display text-[14px] font-medium leading-snug text-foreground">
                {item.product_name}
              </p>
            </div>
          </div>
        </td>

        {hasPersonalizations && (
          <td className="p-4 align-top">
            {allPersonalizations.length > 0 ? (
              <div className="flex flex-col gap-2">
                {allPersonalizations.map((p, pIdx) => {
                  const notesRaw = p.notes || '';
                  const [locationPart, dimPart] = notesRaw.split(' | ');
                  const locationLabel = locationPart ? locationPart.split(' — ')[0] : null;
                  let dimLabel: string | null = null;
                  if (dimPart) {
                    dimLabel = dimPart.replace('cm', ' cm');
                  } else if (p.width_cm && p.height_cm) {
                    dimLabel = `${p.width_cm} × ${p.height_cm} cm`;
                  }
                  return (
                    <div
                      key={pIdx}
                      className="inline-flex flex-col gap-0.5 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5"
                    >
                      <span className="text-[11px] font-semibold tracking-wide text-foreground">
                        <span className="text-primary">✦</span> {p.technique_name}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        {locationLabel && <span>{locationLabel}</span>}
                        {dimLabel && <span className="tabular-nums">{dimLabel}</span>}
                        <span className="tabular-nums">
                          {p.colors_count || 1} {(p.colors_count || 1) > 1 ? 'cores' : 'cor'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground/60">—</span>
            )}
          </td>
        )}
        <td className="w-16 p-4 text-center align-middle text-[14px] font-semibold tabular-nums text-foreground">
          {item.quantity}
        </td>
        <td className="w-28 p-4 text-right align-middle tabular-nums text-[13px] text-muted-foreground">
          <div className="flex flex-col items-end gap-0.5">
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
        <td className="w-32 p-4 text-right align-middle text-[15px] font-semibold tabular-nums text-foreground">
          {formatCurrency(itemTotal)}
        </td>
        <td className="w-20 p-4 text-right align-middle print:hidden">
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
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          Itens do Orçamento
        </h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {items.length} {items.length === 1 ? 'item' : 'itens'}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/30">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="p-4 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Produto
              </th>
              {hasPersonalizations && (
                <th className="p-4 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Personalização
                </th>
              )}
              <th className="w-16 p-4 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Qtd
              </th>
              <th className="w-28 p-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Unitário
              </th>
              <th className="w-32 p-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Total
              </th>
              <th className="w-20 p-4 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {Array.from(kitGroups.entries()).map(([groupId, group]) => (
              <React.Fragment key={groupId}>
                <tr className="border-b border-border/50 bg-primary/[0.04]">
                  <td colSpan={colCount} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                      <span className="font-display text-[12px] font-semibold tracking-wide text-foreground">
                        Kit · {group.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="ml-1 border-border/60 px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                      >
                        {group.items.length} itens
                      </Badge>
                    </div>
                  </td>
                </tr>
                {group.items.map((item, idx) => renderItemRow(item, idx))}
              </React.Fragment>
            ))}
            {kitGroups.size > 0 && looseItems.length > 0 && (
              <tr className="border-b border-border/50 bg-muted/30">
                <td colSpan={colCount} className="px-4 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Itens Avulsos
                  </span>
                </td>
              </tr>
            )}
            {looseItems.map((item, idx) => renderItemRow(item, idx))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

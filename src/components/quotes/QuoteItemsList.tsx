/**
 * QuoteItemsList — Lista de itens do orçamento.
 *
 * Reordenação por drag-and-drop foi removida porque cada orçamento trata um
 * produto por vez (tiragem, gravação, etc.) e mover itens não agrega valor.
 * A ordem segue estritamente a fonte de dados (`items`).
 */

import { Package, Trash2, ChevronDown, ChevronUp, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Badge } from '@/components/ui/badge';
import { PriceFreshnessBadge } from '@/components/products/PriceFreshnessBadge';
import { ProductThumb } from './ProductThumb';
import { cn } from '@/lib/utils';
import { m as motion, AnimatePresence } from 'framer-motion';

import { type QuoteItem } from '@/hooks/quotes/quoteTypes';

interface QuoteItemsListProps {
  items: QuoteItem[];
  onUpdateQuantity: (index: number, quantity: number) => void;
  onUpdatePrice: (index: number, price: number) => void;
  onRemove: (index: number) => void;
  onTogglePersonalization?: (index: number) => void;
  onConfirmPrice?: (index: number) => void;
  expandedItems?: Set<number>;
  renderPersonalization?: (item: QuoteItem, index: number) => React.ReactNode;
  formatCurrency: (value: number) => string;
}

interface QuoteItemRowProps {
  item: QuoteItem;
  index: number;
  isExpanded: boolean;
  onUpdateQuantity: (quantity: number) => void;
  onUpdatePrice: (price: number) => void;
  onRemove: () => void;
  onTogglePersonalization?: () => void;
  onConfirmPrice?: () => void;
  renderPersonalization?: () => React.ReactNode;
  formatCurrency: (value: number) => string;
}

function QuoteItemRow({
  item,
  index,
  isExpanded,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
  onTogglePersonalization,
  onConfirmPrice,
  renderPersonalization,
  formatCurrency,
}: QuoteItemRowProps) {
  const hasPersonalizations = item.personalizations && item.personalizations.length > 0;
  const personalizationTotal = (item.personalizations || []).reduce(
    (sum, p) => sum + (p.total_cost || 0),
    0,
  );
  const itemTotal = item.quantity * item.unit_price + personalizationTotal;

  return (
    <motion.div
      data-testid={`quote-item-${index}`}
      data-quote-item-id={item.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'overflow-hidden border-border/50 bg-card/60 shadow-none transition-all duration-200',
          'hover:border-border hover:bg-card',
          isExpanded && 'flex max-h-[calc(100vh-12rem)] flex-col border-primary/30',
        )}
      >
        {/* Product header — sticky when personalization is open */}
        <div
          className={cn(
            'z-10 bg-card/60 p-3',
            isExpanded && 'sticky top-0 border-b border-border/40 bg-card',
          )}
        >
          <div className="flex items-start gap-2.5">
            {/* Product Image */}
            <ProductThumb
              src={item.product_image_url}
              alt={item.product_name}
              size="list"
              roundedClassName="rounded-md"
              iconClassName="h-5 w-5"
              data-testid="quote-list-thumb"
            />

            {/* Product Info */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-[13px] font-medium leading-tight">{item.product_name}</h4>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="h-5 border-border/60 px-1.5 font-mono text-[10px] font-normal text-muted-foreground">
                      {item.product_sku}
                    </Badge>
                    {item.color_name && (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 border-border/60 px-1.5 text-[10px] font-normal text-muted-foreground"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full ring-1 ring-border/60"
                          style={{ backgroundColor: item.color_hex }}
                        />
                        {item.color_name}
                      </Badge>
                    )}
                    {hasPersonalizations && (
                      <Badge variant="outline" className="h-5 gap-1 border-primary/30 bg-primary/5 px-1.5 text-[10px] font-normal text-primary">
                        <Palette className="h-2.5 w-2.5" />
                        {item.personalizations?.length} gravação(ões)
                      </Badge>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={onRemove}
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Inputs Row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Qtd</span>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === '+' || e.key === 'e') e.preventDefault();
                    }}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const v = parseInt(e.target.value, 10);
                      onUpdateQuantity(Math.max(1, v || 1));
                    }}
                    className="h-7 w-16 px-2 text-xs tabular-nums"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Preço</span>
                  <div className="flex items-center gap-1">
                    <CurrencyInput
                      value={item.unit_price}
                      onChange={(n) => onUpdatePrice(n)}
                      className="h-7 w-24 px-2 text-xs tabular-nums"
                    />
                    <PriceFreshnessBadge
                      priceUpdatedAt={item.price_updated_at}
                      confirmedAt={item.price_confirmed_at}
                      thresholdDays={item.price_freshness_threshold_days}
                      onConfirm={onConfirmPrice}
                      variant="compact"
                    />
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Subtotal</p>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(itemTotal)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Personalization toggle — inside sticky header */}
          {onTogglePersonalization && (
            <div className="mt-2.5">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 w-full justify-between rounded-md border px-2.5 text-xs font-medium transition-all',
                  isExpanded
                    ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
                    : 'border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-accent/40 hover:text-foreground',
                )}
                onClick={onTogglePersonalization}
              >
                <span className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" />
                  Personalização
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Personalization content — scrollable area */}
        {isExpanded && renderPersonalization && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-t border-primary/20 px-4 pb-4 pt-3">
              {renderPersonalization()}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export function QuoteItemsList({
  items,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
  onTogglePersonalization,
  onConfirmPrice,
  expandedItems = new Set(),
  renderPersonalization,
  formatCurrency,
}: QuoteItemsListProps) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-xl border-2 border-dashed py-12 text-center"
        data-testid="quote-items-empty"
      >
        <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="font-medium text-muted-foreground">Nenhum item adicionado</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Pesquise e adicione produtos ao orçamento
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="quote-items-list">
      <AnimatePresence>
        {items.map((item, index) => (
          <QuoteItemRow
            key={item.id || `item-${index}`}
            item={item}
            index={index}
            isExpanded={expandedItems.has(index)}
            onUpdateQuantity={(qty) => onUpdateQuantity(index, qty)}
            onUpdatePrice={(price) => onUpdatePrice(index, price)}
            onRemove={() => onRemove(index)}
            onTogglePersonalization={
              onTogglePersonalization ? () => onTogglePersonalization(index) : undefined
            }
            onConfirmPrice={onConfirmPrice ? () => onConfirmPrice(index) : undefined}
            renderPersonalization={
              renderPersonalization ? () => renderPersonalization(item, index) : undefined
            }
            formatCurrency={formatCurrency}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

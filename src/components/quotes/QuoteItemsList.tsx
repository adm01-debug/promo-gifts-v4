/**
 * QuoteItemsList — Lista de itens do orçamento.
 *
 * Reordenação por drag-and-drop foi removida porque cada orçamento trata um
 * produto por vez (tiragem, gravação, etc.) e mover itens não agrega valor.
 * A ordem segue estritamente a fonte de dados (`items`).
 */

import { useEffect, useState } from 'react';
import { Package, Trash2, ChevronDown, ChevronUp, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Badge } from '@/components/ui/badge';
import { PriceFreshnessBadge } from '@/components/products/PriceFreshnessBadge';
import { ProductThumb } from './ProductThumb';
import { cn } from '@/lib/utils';
import { m as motion, AnimatePresence } from 'framer-motion';
import { showUndoToast } from '@/utils/undoToast';

import { type QuoteItem } from '@/hooks/quotes/quoteTypes';

interface QuoteItemsListProps {
  items: QuoteItem[];
  onUpdateQuantity: (index: number, quantity: number) => void;
  onUpdatePrice: (index: number, price: number) => void;
  onRemove: (index: number) => void;
  onRestore?: (item: QuoteItem, index: number) => void;
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

  // Estado local de string para permitir limpar o campo enquanto digita.
  // O store ignora quantity < 1, então não podemos depender só do valor do item.
  const [qtyDraft, setQtyDraft] = useState<string>(String(item.quantity ?? 1));
  useEffect(() => {
    // Sincroniza quando o item muda externamente (apenas se o usuário não está editando algo diferente).
    setQtyDraft((prev) => {
      const parsed = parseInt(prev, 10);
      if (!Number.isNaN(parsed) && parsed === item.quantity) return prev;
      return String(item.quantity ?? 1);
    });
  }, [item.quantity]);

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
            'z-10 bg-card/60 p-2',
            isExpanded && 'sticky top-0 border-b border-border/40 bg-card',
          )}
        >
          <div className="flex items-start gap-2">

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
                <div className="min-w-0 flex-1 space-y-1">
                  {/* 1) SKU + gravações */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] font-medium uppercase tracking-tight text-muted-foreground">
                      {item.product_sku}
                    </span>
                    {hasPersonalizations && (
                      <Badge variant="outline" className="h-5 gap-1 border-primary/30 bg-primary/5 px-1.5 text-[10px] font-normal text-primary">
                        <Palette className="h-2.5 w-2.5" />
                        {item.personalizations?.length} gravação(ões)
                      </Badge>
                    )}
                  </div>

                  {/* 2) Nome (até 2 linhas) */}
                  <h4
                    className="text-[13px] font-medium leading-snug"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                    title={item.product_name}
                  >
                    {item.product_name}
                  </h4>

                  {/* 3) Cor */}
                  {item.color_name && (
                    <div className="flex flex-wrap items-center gap-1.5">
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
                    </div>
                  )}
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
            </div>
          </div>

          {/* Inputs Row — single line, compact on mobile */}
          <div
            className="mt-2 flex flex-nowrap items-center gap-x-2"
            data-testid="quote-item-inputs-row"
          >
            <div className="flex min-w-0 flex-col items-start leading-tight">
              <span className="whitespace-nowrap text-[10px] uppercase tracking-wide text-muted-foreground">
                Qtd
              </span>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                aria-label="Quantidade"
                value={qtyDraft}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === '.' || e.key === ',') {
                    e.preventDefault();
                  }
                }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const raw = e.target.value;
                  if (raw === '' || /^\d+$/.test(raw)) {
                    setQtyDraft(raw);
                    const v = parseInt(raw, 10);
                    if (!Number.isNaN(v) && v >= 1) onUpdateQuantity(v);
                  }
                }}
                onBlur={() => {
                  const v = parseInt(qtyDraft, 10);
                  if (Number.isNaN(v) || v < 1) {
                    setQtyDraft('1');
                    onUpdateQuantity(1);
                  } else {
                    setQtyDraft(String(v));
                    onUpdateQuantity(v);
                  }
                }}
                data-testid="quote-item-qty-input"
                className="h-7 w-11 px-1 text-xs tabular-nums min-[360px]:w-12 min-[360px]:px-1.5 sm:w-14"
              />
            </div>

            <div className="flex min-w-0 flex-col items-end leading-tight">
              <span className="whitespace-nowrap text-[10px] uppercase tracking-wide text-muted-foreground">
                Vl Unitário
              </span>
              <div className="flex items-center gap-1">
                <span
                  data-testid="quote-item-price-display"
                  role="text"
                  aria-readonly="true"
                  aria-label={`Valor unitário (somente leitura, não editável): ${formatCurrency(item.unit_price)}`}
                  title="Preço definido pelo catálogo — somente leitura, não editável aqui"
                  className="whitespace-nowrap cursor-not-allowed select-none text-xs font-semibold tabular-nums min-[360px]:text-sm"
                >
                  {formatCurrency(item.unit_price)}
                </span>

                <span className="hidden sm:inline-flex">
                  <PriceFreshnessBadge
                    priceUpdatedAt={item.price_updated_at}
                    confirmedAt={item.price_confirmed_at}
                    thresholdDays={item.price_freshness_threshold_days}
                    onConfirm={onConfirmPrice}
                    variant="compact"
                  />
                </span>
              </div>
            </div>
            <div
              className="ml-auto flex min-w-0 flex-col items-end leading-tight"
              data-testid="quote-item-subtotal"
            >
              <span className="whitespace-nowrap text-[10px] uppercase tracking-wide text-muted-foreground">
                Subtotal
              </span>
              <span className="whitespace-nowrap text-xs font-semibold tabular-nums min-[360px]:text-sm">
                {formatCurrency(itemTotal)}
              </span>
            </div>
          </div>




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

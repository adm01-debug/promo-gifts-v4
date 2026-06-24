/**
 * DraggableQuoteItems - Lista de itens do orçamento com drag-and-drop
 * Permite reordenar itens arrastando e soltando
 */

import { useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Package, Trash2, ChevronDown, ChevronUp, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Badge } from '@/components/ui/badge';
import { PriceFreshnessBadge } from '@/components/products/PriceFreshnessBadge';
import { cn } from '@/lib/utils';
import { m as motion, AnimatePresence } from 'framer-motion';

import { type QuoteItem } from '@/hooks/quotes/quoteTypes';

interface DraggableQuoteItemsProps {
  items: QuoteItem[];
  onReorder: (items: QuoteItem[]) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onUpdatePrice: (index: number, price: number) => void;
  onRemove: (index: number) => void;
  onTogglePersonalization?: (index: number) => void;
  onConfirmPrice?: (index: number) => void; // Nova ação
  expandedItems?: Set<number>;
  renderPersonalization?: (item: QuoteItem, index: number) => React.ReactNode;
  formatCurrency: (value: number) => string;
}

interface SortableItemProps {
  item: QuoteItem;
  index: number;
  isExpanded: boolean;
  onUpdateQuantity: (quantity: number) => void;
  onUpdatePrice: (price: number) => void;
  onRemove: () => void;
  onTogglePersonalization?: () => void;
  onConfirmPrice?: () => void; // Adicionado
  renderPersonalization?: () => React.ReactNode;
  formatCurrency: (value: number) => string;
}

function SortableItem({
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
}: SortableItemProps) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id || `item-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  const hasPersonalizations = item.personalizations && item.personalizations.length > 0;
  const personalizationTotal = (item.personalizations || []).reduce(
    (sum, p) => sum + (p.total_cost || 0),
    0,
  );
  const itemTotal = item.quantity * item.unit_price + personalizationTotal;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      data-testid={`quote-item-${index}`}
      data-quote-item-id={item.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'overflow-hidden transition-all duration-200',
          isDragging && 'opacity-50 shadow-2xl ring-2 ring-primary',
          'hover:shadow-md',
          isExpanded && 'flex max-h-[calc(100vh-12rem)] flex-col',
        )}
      >
        {/* Product header — sticky when personalization is open */}
        <div
          className={cn(
            'z-10 bg-card p-4',
            isExpanded && 'sticky top-0 border-b border-border/50 shadow-sm',
          )}
        >
          <div className="flex items-start gap-3">
            {/* Drag handle removido: orçamentos tratam um produto por vez
                (tiragem, gravação, etc) — reordenar não agrega valor aqui. */}



            {/* Product Image */}
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
              {item.product_image_url ? (
                <img
                  src={item.product_image_url}
                  alt={item.product_name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-medium">{item.product_name}</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {item.product_sku}
                    </Badge>
                    {item.color_name && (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-[10px]"
                        style={{
                          backgroundColor: item.color_hex ? `${item.color_hex}20` : undefined,
                          borderColor: item.color_hex,
                        }}
                      >
                        <div
                          className="h-2 w-2 rounded-full border"
                          style={{ backgroundColor: item.color_hex }}
                        />
                        {item.color_name}
                      </Badge>
                    )}
                    {hasPersonalizations && (
                      <Badge variant="secondary" className="gap-1 bg-primary/10 text-[10px]">
                        <Palette className="h-2.5 w-2.5" />
                        {item.personalizations?.length} gravação(ões)
                      </Badge>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onRemove}
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Inputs Row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Qtd:</span>
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
                    className="h-8 w-20 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Preço:</span>
                  <div className="flex items-center gap-1.5">
                    <CurrencyInput
                      value={item.unit_price}
                      onChange={(n) => onUpdatePrice(n)}
                      className="h-8 w-28 text-sm"
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
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-sm font-semibold">{formatCurrency(itemTotal)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Personalization toggle — inside sticky header */}
          {onTogglePersonalization && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-between rounded-lg border text-sm font-medium transition-all',
                  isExpanded
                    ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                    : 'border-border bg-accent/50 hover:border-primary/20 hover:bg-accent',
                )}
                onClick={onTogglePersonalization}
              >
                <span className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Personalização
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
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

export function DraggableQuoteItems({
  items,
  onReorder,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
  onTogglePersonalization,
  onConfirmPrice,
  expandedItems = new Set(),
  renderPersonalization,
  formatCurrency,
}: DraggableQuoteItemsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Gerar IDs únicos para items sem ID
  const itemsWithIds = items.map((item, index) => ({
    ...item,
    id: item.id || `item-${index}`,
  }));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = itemsWithIds.findIndex((item) => item.id === active.id);
      const newIndex = itemsWithIds.findIndex((item) => item.id === over.id);

      const reordered = arrayMove(itemsWithIds, oldIndex, newIndex);
      onReorder(reordered);
    }
  };

  const activeItem = activeId ? itemsWithIds.find((item) => item.id === activeId) : null;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed py-12 text-center">
        <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="font-medium text-muted-foreground">Nenhum item adicionado</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Pesquise e adicione produtos ao orçamento
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={itemsWithIds.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-5">
          <AnimatePresence>
            {itemsWithIds.map((item, index) => (
              <SortableItem
                key={item.id}
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
      </SortableContext>

      <DragOverlay>
        {activeItem && (
          <Card className="opacity-90 shadow-2xl ring-2 ring-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">

                  {activeItem.product_image_url ? (
                    <img
                      src={activeItem.product_image_url}
                      alt={activeItem.product_name}
                      className="h-full w-full rounded-lg object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{activeItem.product_name}</p>
                  <p className="text-xs text-muted-foreground">{activeItem.product_sku}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}

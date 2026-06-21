/**
 * SortableCartItem - Draggable product card for seller carts
 */

import { useState, useRef, useEffect, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { m as motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import {
  Package,
  Trash2,
  Minus,
  Plus,
  Eye,
  MoreHorizontal,
  GripVertical,
  MessageSquare,
  ChevronDown,
  Calculator,
  MoveRight,
  CopyPlus,
  AlertTriangle,
} from 'lucide-react';
import { type SellerCart, type SellerCartItem } from '@/hooks/products';
import { PriceLabel } from './CartUtilComponents';

interface SortableCartItemProps {
  item: SellerCartItem;
  index: number;
  otherCarts: SellerCart[];
  stockMap: Map<string, number>;
  onRemove: (id: string, name: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onMoveToCart: (itemId: string, targetCartId: string) => void;
  onDuplicateToCart: (itemId: string, targetCartId: string) => void;
  onNavigate: (path: string) => void;
}

export const SortableCartItem = memo(
  ({
    item,
    index,
    otherCarts,
    stockMap,
    onRemove,
    onUpdateQuantity,
    onUpdateNotes,
    onMoveToCart,
    onDuplicateToCart,
    onNavigate,
  }: SortableCartItemProps) => {
    const [notesOpen, setNotesOpen] = useState(!!item.notes);
    const [localNotes, setLocalNotes] = useState(item.notes || '');
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    // Sync localNotes from server when no pending debounce (user not typing).
    // Keeps the field current after React Query refetches without clobbering an
    // in-progress edit.
    useEffect(() => {
      if (!debounceRef.current) {
        setLocalNotes(item.notes || '');
      }
    }, [item.notes]);

    // C2: rascunho local da quantidade — permite digitar livremente (incl. multi-digito
    // e estado vazio transitorio) e so persiste no commit (blur/Enter), evitando uma
    // escrita no banco + invalidacao por tecla (ex.: '500' gerava 3 writes: 5, 50, 500).
    const [qtyDraft, setQtyDraft] = useState(String(item.quantity));
    useEffect(() => {
      setQtyDraft(String(item.quantity));
    }, [item.quantity]);

    useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, []);

    const commitQty = () => {
      const val = parseInt(qtyDraft, 10);
      if (isNaN(val) || val < 1) {
        setQtyDraft(String(item.quantity)); // reverte entrada vazia/invalida
        return;
      }
      const clamped = Math.min(val, 999999);
      if (clamped !== item.quantity) onUpdateQuantity(item.id, clamped);
      setQtyDraft(String(clamped));
    };

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: item.id,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: isDragging ? undefined : transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 50 : undefined,
    };

    const itemTotal = (Number(item.product_price) || 0) * (Number(item.quantity) || 0);
    const stock = stockMap.get(item.product_id);
    const isLowStock = stock !== undefined && stock < item.quantity;
    const isOutOfStock = stock !== undefined && stock === 0;

    const handleNotesChange = (value: string) => {
      setLocalNotes(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdateNotes(item.id, value);
        // Clear the ref so the server-sync effect (guarded by !debounceRef.current)
        // re-enables after the write settles; otherwise it stays disabled forever.
        debounceRef.current = undefined;
      }, 800);
    };

    return (
      <motion.div
        ref={setNodeRef}
        style={style}
        data-testid="cart-item"
        data-cart-item-id={item.id}
        data-product-id={item.product_id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: index * 0.03 }}
      >
        <Card
          className={cn(
            'group overflow-hidden transition-all duration-200 hover:border-primary/20',
            isDragging && 'shadow-xl ring-2 ring-primary/30',
            isOutOfStock && 'opacity-60',
          )}
        >
          {/* Product image */}
          <div className="group/img-container relative aspect-square overflow-hidden bg-muted/20">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="absolute left-2.5 top-2.5 z-20 flex h-8 w-8 cursor-grab items-center justify-center rounded-xl border border-border/50 bg-card/90 text-muted-foreground opacity-0 shadow-sm backdrop-blur-md transition-all duration-300 hover:text-primary active:cursor-grabbing group-hover:opacity-100"
              aria-label="Arrastar"
            >
              <GripVertical className="h-4 w-4" />
            </button>

            <button
              type="button"
              data-testid="cart-item-image"
              aria-label={`Ver produto ${item.product_name}`}
              className="relative z-10 h-full w-full cursor-pointer bg-transparent p-0"
              onClick={() => onNavigate(`/produto/${item.product_id}`)}
            >
              {!item.product_image_url && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="h-14 w-14 animate-pulse text-muted-foreground/20" />
                </div>
              )}
              <motion.img
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.08 }}
                src={item.product_image_url || '/placeholder.svg'}
                alt={item.product_name}
                className={cn(
                  'h-full w-full object-contain p-6 transition-all duration-500',
                  !item.product_image_url && 'opacity-0',
                )}
                loading="lazy"
              />
            </button>

            {/* Quick view overlay — mouse-only enhancement; keyboard path is via dropdown menu */}
            <div
              data-testid="cart-item-view"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/10 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover:pointer-events-auto group-hover:opacity-100"
            >
              <Button
                variant="secondary"
                size="sm"
                tabIndex={-1}
                className="gap-2 border border-white/20 bg-card/90 text-[11px] font-bold shadow-lg hover:bg-card"
                onClick={() => onNavigate(`/produto/${item.product_id}`)}
              >
                <Eye className="h-3.5 w-3.5" />
                Ver Produto
              </Button>
            </div>

            {/* Actions menu */}
            <div className="absolute right-2.5 top-2.5 z-20 opacity-0 transition-all duration-300 group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-testid="cart-item-menu-trigger"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/50 bg-card/90 text-muted-foreground shadow-sm backdrop-blur-md transition-all hover:text-primary"
                    aria-label={`Mais opções para ${item.product_name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                  <DropdownMenuItem
                    data-testid="cart-item-action-view"
                    className="rounded-lg py-2"
                    onClick={() => onNavigate(`/produto/${item.product_id}`)}
                  >
                    <Eye className="mr-2.5 h-4 w-4 opacity-70" /> Ver Produto
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="cart-item-action-simulate"
                    className="rounded-lg py-2"
                    onClick={() => onNavigate(`/simulador?product=${item.product_id}`)}
                  >
                    <Calculator className="mr-2.5 h-4 w-4 opacity-70" /> Simular Personalização
                  </DropdownMenuItem>
                  {otherCarts.length > 0 && (
                    <>
                      <DropdownMenuSeparator className="my-1.5" />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger
                          data-testid="cart-item-action-move"
                          className="rounded-lg py-2"
                        >
                          <MoveRight className="mr-2.5 h-4 w-4 opacity-70" /> Mover para...
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="min-w-[180px] rounded-xl p-1.5">
                          {otherCarts.map((c) => (
                            <DropdownMenuItem
                              key={c.id}
                              data-testid="cart-item-move-target"
                              data-target-cart-id={c.id}
                              className="rounded-lg py-2"
                              onClick={() => onMoveToCart(item.id, c.id)}
                            >
                              {c.company_name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger
                          data-testid="cart-item-action-duplicate"
                          className="rounded-lg py-2"
                        >
                          <CopyPlus className="mr-2.5 h-4 w-4 opacity-70" /> Duplicar para...
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="min-w-[180px] rounded-xl p-1.5">
                          {otherCarts.map((c) => (
                            <DropdownMenuItem
                              key={c.id}
                              data-testid="cart-item-duplicate-target"
                              data-target-cart-id={c.id}
                              className="rounded-lg py-2"
                              onClick={() => onDuplicateToCart(item.id, c.id)}
                            >
                              {c.company_name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}
                  <DropdownMenuSeparator className="my-1.5" />
                  <DropdownMenuItem
                    data-testid="cart-item-action-remove"
                    className="rounded-lg py-2 text-destructive focus:bg-destructive/5 focus:text-destructive"
                    onClick={() => onRemove(item.id, item.product_name)}
                  >
                    <Trash2 className="mr-2.5 h-4 w-4 opacity-70" /> Remover Item
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Stock alert badge */}
            {(isLowStock || isOutOfStock) && (
              <motion.div
                data-testid={isOutOfStock ? 'cart-item-stock-out' : 'cart-item-stock-low'}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  'absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-lg backdrop-blur-md',
                  isOutOfStock
                    ? 'border-destructive/20 bg-destructive/90 text-destructive-foreground'
                    : 'border-warning/20 bg-warning/90 text-warning-foreground',
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {isOutOfStock ? 'SEM ESTOQUE' : `ESTOQUE: ${stock}`}
              </motion.div>
            )}

            {/* Color badge */}
            {item.color_name && (
              <div
                data-testid="cart-item-color"
                className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-full border border-border/50 bg-card/90 px-2.5 py-1 shadow-sm backdrop-blur-md"
              >
                <div
                  className="h-3.5 w-3.5 rounded-full border border-border/50 shadow-inner"
                  style={{ backgroundColor: item.color_hex || 'transparent' }}
                />
                <span
                  data-testid="cart-item-color-name"
                  className="text-[10px] font-bold uppercase tracking-tight opacity-80"
                >
                  {item.color_name}
                </span>
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="space-y-2.5 p-3.5">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                {item.product_sku && (
                  <span
                    data-testid="cart-item-sku"
                    className="w-fit rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {item.product_sku}
                  </span>
                )}
                {isLowStock && !isOutOfStock && (
                  <span className="text-[9px] font-bold uppercase tracking-tight text-warning">
                    Estoque Crítico
                  </span>
                )}
              </div>
              <button
                type="button"
                data-testid="cart-item-name"
                aria-label={`Ver produto ${item.product_name}`}
                className="line-clamp-2 min-h-[2.5rem] w-full cursor-pointer text-left text-sm font-semibold leading-tight transition-colors hover:text-primary group-hover:text-primary"
                onClick={() => onNavigate(`/produto/${item.product_id}`)}
              >
                {item.product_name}
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/10 bg-muted/20 p-2">
              <PriceLabel
                label="Unitário"
                value={item.product_price}
                testId="cart-item-unit-price"
                isPrimary
                className="flex-row items-baseline gap-1.5 space-y-0"
              />
              {item.quantity > 50 && (
                <Badge
                  variant="outline"
                  className="h-4 border-success/20 bg-success/5 px-1 text-[9px] text-success"
                >
                  Atacado
                </Badge>
              )}
            </div>

            {/* Quantity stepper & Subtotal */}
            <div className="flex items-center justify-between gap-3 border-t border-border/30 pt-2">
              <div
                data-testid="cart-item-qty-stepper"
                className="flex items-center gap-0 overflow-hidden rounded-lg border border-border/50 bg-background shadow-sm transition-colors hover:border-primary/30"
              >
                <button
                  type="button"
                  data-testid="cart-qty-decrement"
                  aria-label={
                    item.quantity <= 1
                      ? `Remover ${item.product_name}`
                      : `Diminuir quantidade de ${item.product_name}`
                  }
                  className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground active:scale-90"
                  onClick={() => {
                    if (item.quantity <= 1) {
                      onRemove(item.id, item.product_name);
                    } else {
                      onUpdateQuantity(item.id, item.quantity - 1);
                    }
                  }}
                >
                  {item.quantity <= 1 ? (
                    <Trash2
                      data-testid="cart-qty-remove-icon"
                      className="h-4 w-4 text-destructive"
                    />
                  ) : (
                    <Minus data-testid="cart-qty-decrement-icon" className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="number"
                  min={1}
                  max={999999}
                  aria-label={`Quantidade para ${item.product_name}`}
                  data-testid="cart-qty-input"
                  value={qtyDraft}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setQtyDraft(e.target.value)}
                  onBlur={commitQty}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  className="m-0 h-9 w-12 appearance-none border-x border-border/30 bg-transparent text-center text-sm font-bold tabular-nums transition-all [appearance:textfield] focus:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  data-testid="cart-qty-increment"
                  aria-label={`Aumentar quantidade de ${item.product_name}`}
                  disabled={item.quantity >= 999999}
                  className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground active:scale-90 active:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    if (item.quantity >= 999999) return;
                    onUpdateQuantity(item.id, item.quantity + 1);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col items-end">
                <PriceLabel
                  label="Subtotal"
                  value={itemTotal}
                  testId="cart-item-total"
                  className="items-end"
                />
              </div>
            </div>

            {/* Collapsible notes */}
            <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  data-testid="cart-item-notes-toggle"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border border-transparent p-2 text-[10px] font-bold uppercase tracking-wider transition-all',
                    item.notes
                      ? 'border-primary/10 bg-primary/5 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                  aria-label={
                    item.notes
                      ? `Ver observações de ${item.product_name}`
                      : `Adicionar observação a ${item.product_name}`
                  }
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {item.notes ? 'Ver Observações' : 'Adicionar Observação'}
                  <div className="flex-1" />
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform duration-300',
                      notesOpen && 'rotate-180',
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Textarea
                  data-testid="cart-item-notes-input"
                  aria-label={`Observações para ${item.product_name}`}
                  value={localNotes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="Ex: personalizar com logo do cliente..."
                  className="min-h-[70px] resize-none border-border/40 bg-muted/5 text-xs focus:ring-primary/20"
                  rows={3}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </Card>
      </motion.div>
    );
  },
);

SortableCartItem.displayName = 'SortableCartItem';

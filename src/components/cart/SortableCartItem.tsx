/**
 * SortableCartItem - Draggable product card for seller carts
 */

import { useState, useRef, memo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  Package, Trash2, Minus, Plus, Eye, MoreHorizontal, GripVertical,
  MessageSquare, ChevronDown, Calculator, MoveRight, CopyPlus,
  AlertTriangle,
} from "lucide-react";
import { type SellerCart, type SellerCartItem } from "@/hooks/products";
import { PriceLabel } from "./CartUtilComponents";

interface SortableCartItemProps {
  item: SellerCartItem;
  index: number;
  otherCarts: SellerCart[];
  companyAccentColor?: string | null;
  stockMap: Map<string, number>;
  onRemove: (id: string, name: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onMoveToCart: (itemId: string, targetCartId: string) => void;
  onDuplicateToCart: (itemId: string, targetCartId: string) => void;
  onNavigate: (path: string) => void;
}

export const SortableCartItem = memo(function SortableCartItem({
  item, index, otherCarts, companyAccentColor, stockMap,
  onRemove, onUpdateQuantity, onUpdateNotes, onMoveToCart, onDuplicateToCart, onNavigate,
}: SortableCartItemProps) {
  const [notesOpen, setNotesOpen] = useState(!!item.notes);
  const [localNotes, setLocalNotes] = useState(item.notes || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const itemTotal = item.product_price * item.quantity;
  const stock = stockMap.get(item.product_id);
  const isLowStock = stock !== undefined && stock < item.quantity;
  const isOutOfStock = stock !== undefined && stock === 0;

  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onUpdateNotes(item.id, value), 800);
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
      <Card className={cn(
        "overflow-hidden group hover:border-primary/20 transition-all duration-200",
        isDragging && "shadow-xl ring-2 ring-primary/30",
        isOutOfStock && "opacity-60"
      )}>
        {companyAccentColor && (
          <div className="h-1 w-full" style={{ backgroundColor: companyAccentColor }} />
        )}

        {/* Product image */}
        <div className="relative aspect-square bg-muted/20 group/img-container overflow-hidden">
          <button
            {...attributes}
            {...listeners}
            className="absolute top-2.5 left-2.5 z-20 h-8 w-8 flex items-center justify-center rounded-xl bg-card/90 backdrop-blur-md text-muted-foreground hover:text-primary cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-sm border border-border/50"
            aria-label="Arrastar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          
          <div
            data-testid="cart-item-image"
            className="w-full h-full cursor-pointer relative z-10"
            onClick={() => onNavigate(`/produto/${item.product_id}`)}
          >
            {!item.product_image_url && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Package className="h-14 w-14 text-muted-foreground/20 animate-pulse" />
              </div>
            )}
            <motion.img 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.08 }}
              src={item.product_image_url || "/placeholder.svg"} 
              alt={item.product_name} 
              className={cn(
                "w-full h-full object-contain p-6 transition-all duration-500",
                !item.product_image_url && "opacity-0"
              )} 
              loading="lazy" 
            />
          </div>

          {/* Quick view overlay */}
          <div
            data-testid="cart-item-view"
            className="absolute inset-0 bg-primary/10 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center cursor-pointer z-20"
            onClick={() => onNavigate(`/produto/${item.product_id}`)}
          >
            <Button variant="secondary" size="sm" className="gap-2 text-[11px] font-bold shadow-lg border border-white/20 bg-card/90 hover:bg-card">
              <Eye className="h-3.5 w-3.5" />
              Ver Produto
            </Button>
          </div>

          {/* Actions menu */}
          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  data-testid="cart-item-menu-trigger" 
                  className="h-8 w-8 flex items-center justify-center rounded-xl bg-card/90 backdrop-blur-md text-muted-foreground hover:text-primary transition-all shadow-sm border border-border/50" 
                  aria-label="Mais opções"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl">
                <DropdownMenuItem data-testid="cart-item-action-view" className="rounded-lg py-2" onClick={() => onNavigate(`/produto/${item.product_id}`)}>
                  <Eye className="h-4 w-4 mr-2.5 opacity-70" /> Ver Produto
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="cart-item-action-simulate" className="rounded-lg py-2" onClick={() => onNavigate(`/simulador?product=${item.product_id}`)}>
                  <Calculator className="h-4 w-4 mr-2.5 opacity-70" /> Simular Personalização
                </DropdownMenuItem>
                {otherCarts.length > 0 && (
                  <>
                    <DropdownMenuSeparator className="my-1.5" />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger data-testid="cart-item-action-move" className="rounded-lg py-2">
                        <MoveRight className="h-4 w-4 mr-2.5 opacity-70" /> Mover para...
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="p-1.5 rounded-xl min-w-[180px]">
                        {otherCarts.map(c => (
                          <DropdownMenuItem key={c.id} data-testid="cart-item-move-target" data-target-cart-id={c.id} className="rounded-lg py-2" onClick={() => onMoveToCart(item.id, c.id)}>
                            {c.company_name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger data-testid="cart-item-action-duplicate" className="rounded-lg py-2">
                        <CopyPlus className="h-4 w-4 mr-2.5 opacity-70" /> Duplicar para...
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="p-1.5 rounded-xl min-w-[180px]">
                        {otherCarts.map(c => (
                          <DropdownMenuItem key={c.id} data-testid="cart-item-duplicate-target" data-target-cart-id={c.id} className="rounded-lg py-2" onClick={() => onDuplicateToCart(item.id, c.id)}>
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
                  className="text-destructive focus:text-destructive focus:bg-destructive/5 rounded-lg py-2"
                  onClick={() => onRemove(item.id, item.product_name)}
                >
                  <Trash2 className="h-4 w-4 mr-2.5 opacity-70" /> Remover Item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stock alert badge */}
          {(isLowStock || isOutOfStock) && (
            <motion.div
              data-testid={isOutOfStock ? "cart-item-stock-out" : "cart-item-stock-low"}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg backdrop-blur-md z-20 border",
                isOutOfStock
                  ? "bg-destructive/90 text-destructive-foreground border-destructive/20"
                  : "bg-warning/90 text-warning-foreground border-warning/20",
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {isOutOfStock ? "SEM ESTOQUE" : `ESTOQUE: ${stock}`}
            </motion.div>
          )}

          {/* Color badge */}
          {item.color_name && (
            <div data-testid="cart-item-color" className="absolute bottom-3 left-3 flex items-center gap-2 bg-card/90 backdrop-blur-md rounded-full px-2.5 py-1 border border-border/50 shadow-sm z-20">
              <div className="w-3.5 h-3.5 rounded-full border border-border/50 shadow-inner" style={{ backgroundColor: item.color_hex || undefined }} />
              <span data-testid="cart-item-color-name" className="text-[10px] font-bold uppercase tracking-tight opacity-80">{item.color_name}</span>
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              {item.product_sku && (
                <span data-testid="cart-item-sku" className="text-[10px] text-muted-foreground font-mono bg-muted/50 w-fit px-1.5 py-0.5 rounded-sm">{item.product_sku}</span>
              )}
              {isLowStock && !isOutOfStock && (
                <span className="text-[9px] font-bold text-warning uppercase tracking-tight">Estoque Crítico</span>
              )}
            </div>
            <h4 data-testid="cart-item-name" className="text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors cursor-pointer" onClick={() => onNavigate(`/produto/${item.product_id}`)}>
              {item.product_name}
            </h4>
          </div>

          <div className="flex items-center justify-between bg-muted/20 p-2 rounded-lg border border-border/10">
            <PriceLabel
              label="Unitário"
              value={item.product_price}
              testId="cart-item-unit-price"
              isPrimary
              className="flex-row items-baseline gap-1.5 space-y-0"
            />
            {item.quantity > 50 && (
               <Badge variant="outline" className="text-[9px] h-4 px-1 bg-success/5 text-success border-success/20">Atacado</Badge>
            )}
          </div>

          {/* Quantity stepper & Subtotal */}
          <div className="flex items-center justify-between pt-2 border-t border-border/30 gap-3">
            <div data-testid="cart-item-qty-stepper" className="flex items-center gap-0 border border-border/50 rounded-lg overflow-hidden bg-background shadow-sm hover:border-primary/30 transition-colors">
              <button
                data-testid="cart-qty-decrement"
                aria-label="Diminuir quantidade"
                className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-90"
                onClick={() => {
                  if (item.quantity <= 1) {
                    onRemove(item.id, item.product_name);
                  } else {
                    onUpdateQuantity(item.id, item.quantity - 1);
                  }
                }}
              >
                {item.quantity <= 1 ? (
                  <Trash2 data-testid="cart-qty-remove-icon" className="h-4 w-4 text-destructive" />
                ) : (
                  <Minus data-testid="cart-qty-decrement-icon" className="h-4 w-4" />
                )}
              </button>
              <input
                type="number"
                data-testid="cart-qty-input"
                value={item.quantity}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0) onUpdateQuantity(item.id, val);
                }}
                className="h-9 w-12 text-center text-sm font-bold tabular-nums bg-transparent border-x border-border/30 focus:outline-none focus:ring-1 focus:ring-primary/20 appearance-none m-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none transition-all focus:bg-primary/5"
              />
              <button
                data-testid="cart-qty-increment"
                aria-label="Aumentar quantidade"
                className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted/80 transition-all active:scale-90"
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
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
                data-testid="cart-item-notes-toggle" 
                className={cn(
                  "flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all w-full p-2 rounded-lg border border-transparent",
                  item.notes 
                    ? "text-primary bg-primary/5 border-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )} 
                aria-label="Notas do item"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {item.notes ? "Ver Observações" : "Adicionar Observação"}
                <div className="flex-1" />
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", notesOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Textarea
                data-testid="cart-item-notes-input"
                value={localNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Ex: personalizar com logo do cliente..."
                className="text-xs min-h-[70px] resize-none focus:ring-primary/20 bg-muted/5 border-border/40"
                rows={3}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </Card>
    </motion.div>
  );
});

SortableCartItem.displayName = 'SortableCartItem';

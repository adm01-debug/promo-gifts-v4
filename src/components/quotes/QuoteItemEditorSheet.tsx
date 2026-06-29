/**
 * QuoteItemEditorSheet — Painel lateral direito para edição do item ativo.
 *
 * Etapa 1 do redesign: migra a antiga Coluna 2 (Itens do Orçamento + editor de
 * Personalização inline) para um drawer lateral controlado, deixando o builder
 * em 2 colunas (Cliente/Condições + Resumo) — mais clean e elegante.
 *
 * Lógica de preço/personalização é preservada — apenas o invólucro muda.
 */
import { Package, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { QuoteItemsList } from './QuoteItemsList';
import { QuoteProductCustomization } from './QuoteProductCustomization';
import type { QuoteItem, QuoteItemPersonalization } from '@/hooks/quotes/quoteTypes';

interface QuoteItemEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: QuoteItem | null;
  index: number | null;
  onUpdateQuantity: (index: number, qty: number) => void;
  onUpdatePrice: (index: number, price: number) => void;
  onRemove: (index: number) => void;
  onConfirmPrice: (index: number) => void;
  onPersonalizationsChange: (index: number, p: QuoteItemPersonalization[]) => void;
  formatCurrency: (value: number) => string;
  onAddProduct: () => void;
}

export function QuoteItemEditorSheet({
  open,
  onOpenChange,
  item,
  index,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
  onConfirmPrice,
  onPersonalizationsChange,
  formatCurrency,
  onAddProduct,
}: QuoteItemEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 bg-background p-0 sm:max-w-[430px]"
        data-testid="quote-item-editor-sheet"
        aria-label="Editor de item do orçamento"
      >
        <SheetHeader className="shrink-0 border-b border-border/50 px-2 py-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              data-testid="quote-add-product-button-sheet"
              onClick={onAddProduct}
              className="group h-8 rounded-full border-[1.5px] border-primary/70 bg-transparent px-3 text-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12),0_0_18px_hsl(var(--primary)/0.35)] transition-all hover:border-primary hover:bg-primary/5 hover:text-primary hover:shadow-[0_0_0_4px_hsl(var(--primary)/0.18),0_0_24px_hsl(var(--primary)/0.55)] focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Plus className="mr-1 h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
              <span className="font-medium">Produto</span>
            </Button>
            <SheetTitle className="sr-only">Editor de item do orçamento</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto bg-background px-2 py-2 [&_.bg-card\/60]:!bg-transparent [&_.bg-card]:!bg-transparent [&_.rounded-2xl]:!rounded-none [&_.rounded-2xl]:!border-0 [&_.rounded-2xl]:!shadow-none">
          {item && index !== null ? (
            <div className="space-y-2">

              <QuoteItemsList
                items={[item]}
                onUpdateQuantity={(_, qty) => onUpdateQuantity(index, qty)}
                onUpdatePrice={(_, price) => onUpdatePrice(index, price)}
                onRemove={() => {
                  onRemove(index);
                  onOpenChange(false);
                }}
                onConfirmPrice={() => onConfirmPrice(index)}
                onTogglePersonalization={() => {
                  /* sempre aberto dentro do sheet */
                }}
                expandedItems={new Set([0])}
                renderPersonalization={() => (
                  <QuoteProductCustomization
                    productId={item.product_id}
                    quantity={item.quantity}
                    existingPersonalizations={item.personalizations}
                    onPersonalizationsChange={(p) => onPersonalizationsChange(index, p)}
                    layout="stacked"
                  />
                )}
                formatCurrency={formatCurrency}
              />
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground">
              <Package className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">Nenhum item selecionado</p>
              <p className="mt-1 text-xs">Adicione ou clique em um item do resumo</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

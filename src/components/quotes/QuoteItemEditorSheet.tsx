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
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[430px]"
        data-testid="quote-item-editor-sheet"
      >
        <SheetHeader className="shrink-0 border-b border-border/50 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="font-display text-base font-semibold">
              Detalhes do Item
            </SheetTitle>
            <Button
              size="sm"
              variant="default"
              data-testid="quote-add-product-button-sheet"
              onClick={onAddProduct}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Produto
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {item && index !== null ? (
            <div className="space-y-3">
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

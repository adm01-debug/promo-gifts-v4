/**
 * QuoteItemEditorSheet — Painel lateral direito para edição do item ativo.
 *
 * Etapa 1 do redesign: migra a antiga Coluna 2 (Itens do Orçamento + editor de
 * Personalização inline) para um drawer lateral controlado, deixando o builder
 * em 2 colunas (Cliente/Condições + Resumo) — mais clean e elegante.
 *
 * Lógica de preço/personalização é preservada — apenas o invólucro muda.
 */
import { useState } from 'react';
import { Check, Package } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  onRestore?: (item: QuoteItem, index: number) => void;
  onConfirmPrice: (index: number) => void;
  onPersonalizationsChange: (index: number, p: QuoteItemPersonalization[]) => void;
  formatCurrency: (value: number) => string;
  onAddProduct: () => void;
  /**
   * Quando `true`, intercepta o fechamento implícito (ESC / click-outside)
   * com um AlertDialog do shadcn. Ações explícitas (Salvar / Remover)
   * sempre fecham direto, sem confirmação.
   */
  hasUnsavedChanges?: boolean;
  /** Mensagem da confirmação. Default em PT-BR. */
  unsavedChangesMessage?: string;
}

export function QuoteItemEditorSheet({
  open,
  onOpenChange,
  item,
  index,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
  onRestore,
  onConfirmPrice,
  onPersonalizationsChange,
  formatCurrency,
  onAddProduct,
  hasUnsavedChanges = false,
  unsavedChangesMessage = 'Você tem alterações não salvas neste item. Deseja realmente fechar e descartá-las?',
}: QuoteItemEditorSheetProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requestClose = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (hasUnsavedChanges) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange(false);
  };


  return (
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[430px]"
        data-testid="quote-item-editor-sheet"
        aria-label="Editor de item do orçamento"
      >
        <SheetHeader className="shrink-0 border-b border-border/50 px-1.5 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="quote-save-item-button-sheet"
              onClick={() => onOpenChange(false)}
              disabled={!item}
              aria-label={item ? 'Salvar escolhas do produto e fechar editor' : 'Salvar indisponível — nenhum item selecionado'}
              aria-disabled={!item}
              title="Salvar escolhas do produto"
              className="group h-8 rounded-full border-[1.5px] border-primary/70 bg-transparent px-3 text-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12),0_0_18px_hsl(var(--primary)/0.35)] transition-all hover:border-primary hover:bg-primary/5 hover:text-primary hover:shadow-[0_0_0_4px_hsl(var(--primary)/0.18),0_0_24px_hsl(var(--primary)/0.55)] focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-medium">Salvar</span>
            </Button>
            <SheetTitle className="sr-only">Editor de item do orçamento</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-y-auto px-1.5 py-1.5">
          {item && index !== null ? (
            <div className="flex min-h-full flex-1 flex-col space-y-3 [&>*]:flex-1 [&_.bg-card\/60]:bg-transparent [&_.bg-card]:bg-transparent [&_.rounded-2xl]:flex [&_.rounded-2xl]:!max-h-none [&_.rounded-2xl]:flex-1 [&_.rounded-2xl]:flex-col [&_.rounded-2xl]:rounded-none [&_.rounded-2xl]:border-0 [&_.rounded-2xl]:shadow-none">


              <QuoteItemsList
                items={[item]}
                onUpdateQuantity={(_, qty) => onUpdateQuantity(index, qty)}
                onUpdatePrice={(_, price) => onUpdatePrice(index, price)}
                onRemove={() => {
                  onRemove(index);
                  onOpenChange(false);
                }}
                onRestore={onRestore ? (it) => onRestore(it, index) : undefined}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="quote-editor-unsaved-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>{unsavedChangesMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="quote-editor-unsaved-cancel">
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="quote-editor-unsaved-confirm"
              onClick={() => {
                setConfirmOpen(false);
                onOpenChange(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar e fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}


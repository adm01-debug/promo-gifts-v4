/**
 * Dev-only harness para `QuoteItemEditorSheet`.
 *
 * Renderiza apenas o trigger + sheet para validar header order, overflow
 * em múltiplos viewports, foco/tab e o ciclo Salvar/fechar.
 *
 * Query params:
 *  - `withItem=1`     → injeta um QuoteItem sintético (Salvar habilitado).
 *  - `longContent=1`  → adiciona muitas linhas de texto pra estressar a
 *                       ScrollArea e validar gap inferior em viewports.
 *
 * Rota: `/__visual/quote-item-editor-sheet` (somente em DEV).
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { QuoteItemEditorSheet } from '@/components/quotes/QuoteItemEditorSheet';
import type { QuoteItem } from '@/hooks/quotes/quoteTypes';

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function makeStubItem(longContent: boolean): QuoteItem {
  return {
    id: 'stub-item-1',
    product_id: 'stub-product-1',
    product_name: longContent
      ? 'Caneca cerâmica premium personalizada — edição corporativa (stub e2e)'
      : 'Produto de teste',
    product_sku: 'STUB-001',
    quantity: 10,
    unit_price: 25.5,
    subtotal: 255,
    notes: longContent
      ? Array.from({ length: 12 }, (_, i) => `Linha ${i + 1} de observação longa para estressar a área rolável do sheet.`).join('\n')
      : 'Item sintético para validar o ciclo Salvar/fechar.',
    personalizations: [],
  };
}

export default function QuoteItemEditorSheetHarness() {
  const [open, setOpen] = useState(false);
  const [addProductClicks, setAddProductClicks] = useState(0);

  const params = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);
  const withItem = params.get('withItem') === '1';
  const longContent = params.get('longContent') === '1';
  const unsaved = params.get('unsaved') === '1';
  const item = withItem ? makeStubItem(longContent) : null;
  const index = withItem ? 0 : null;

  return (
    <main
      data-testid="quote-item-editor-sheet-harness"
      className="min-h-dvh bg-background p-4"
    >
      <Button data-testid="open-editor-sheet" onClick={() => setOpen(true)}>
        Abrir editor
      </Button>
      <div
        data-testid="add-product-click-count"
        data-count={addProductClicks}
        className="sr-only"
      >
        {addProductClicks}
      </div>
      <div
        data-testid="sheet-open-state"
        data-open={open ? '1' : '0'}
        className="sr-only"
      >
        {open ? 'open' : 'closed'}
      </div>
      <QuoteItemEditorSheet
        open={open}
        onOpenChange={setOpen}
        item={item}
        index={index}
        onUpdateQuantity={() => {}}
        onUpdatePrice={() => {}}
        onRemove={() => {}}
        onConfirmPrice={() => {}}
        onPersonalizationsChange={() => {}}
        formatCurrency={fmt}
        onAddProduct={() => setAddProductClicks((c) => c + 1)}
        hasUnsavedChanges={unsaved}
      />
    </main>
  );
}

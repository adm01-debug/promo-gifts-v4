/**
 * Dev-only harness para `QuoteItemEditorSheet`.
 *
 * Renderiza apenas o trigger + sheet (item=null → empty state) para
 * validar header order, overflow em 320/375/768 e foco/tab no mobile.
 *
 * Rota: `/__visual/quote-item-editor-sheet` (somente em DEV).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QuoteItemEditorSheet } from '@/components/quotes/QuoteItemEditorSheet';

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function QuoteItemEditorSheetHarness() {
  const [open, setOpen] = useState(false);
  return (
    <main
      data-testid="quote-item-editor-sheet-harness"
      className="min-h-dvh bg-background p-4"
    >
      <Button data-testid="open-editor-sheet" onClick={() => setOpen(true)}>
        Abrir editor
      </Button>
      <QuoteItemEditorSheet
        open={open}
        onOpenChange={setOpen}
        item={null}
        index={null}
        onUpdateQuantity={() => {}}
        onUpdatePrice={() => {}}
        onRemove={() => {}}
        onConfirmPrice={() => {}}
        onPersonalizationsChange={() => {}}
        formatCurrency={fmt}
        onAddProduct={() => {}}
      />
    </main>
  );
}

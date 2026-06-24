/**
 * Testes — DraggableQuoteItems
 *
 * Garantem que:
 *  - Não há handle de arrasto renderizado no card (sem GripVertical, sem
 *    elemento com `aria-label` de arrastar).
 *  - A ordem renderizada espelha estritamente a prop `items` (fonte de
 *    dados única) — uma "tentativa" de drag não muda nada.
 *  - O componente não importa nem usa `@dnd-kit/*` (gate estático contra
 *    regressão futura).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DraggableQuoteItems } from '../DraggableQuoteItems';
import type { QuoteItem } from '@/hooks/quotes/quoteTypes';

const items: QuoteItem[] = [
  {
    id: 'a',
    product_id: 'p-a',
    product_name: 'Produto A',
    product_sku: 'SKU-A',
    product_image_url: null,
    color_name: null,
    color_hex: null,
    quantity: 1,
    unit_price: 10,
    personalizations: [],
  } as unknown as QuoteItem,
  {
    id: 'b',
    product_id: 'p-b',
    product_name: 'Produto B',
    product_sku: 'SKU-B',
    product_image_url: null,
    color_name: null,
    color_hex: null,
    quantity: 2,
    unit_price: 20,
    personalizations: [],
  } as unknown as QuoteItem,
];

function renderList(extra?: Partial<React.ComponentProps<typeof DraggableQuoteItems>>) {
  return render(
    <DraggableQuoteItems
      items={items}
      onUpdateQuantity={() => {}}
      onUpdatePrice={() => {}}
      onRemove={() => {}}
      formatCurrency={(v) => `R$ ${v.toFixed(2)}`}
      {...extra}
    />,
  );
}

describe('DraggableQuoteItems — sem drag-and-drop', () => {
  it('não renderiza handle de arrasto nos cards', () => {
    const { container } = renderList();
    expect(screen.queryByLabelText(/arrastar/i)).toBeNull();
    expect(container.querySelector('svg.lucide-grip-vertical')).toBeNull();
    // Nenhum elemento com cursor de grab/grabbing.
    expect(container.querySelector('[class*="cursor-grab"]')).toBeNull();
  });

  it('ordem renderizada espelha a prop items e é estável após "drag" sintético', () => {
    renderList();
    const rows = screen.getAllByTestId(/^quote-item-\d+$/);
    expect(rows.map((r) => r.getAttribute('data-quote-item-id'))).toEqual(['a', 'b']);

    // Simula tentativa de arrastar o primeiro item — não deve reordenar.
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[1]);
    fireEvent.drop(rows[1]);
    fireEvent.dragEnd(rows[0]);

    const after = screen.getAllByTestId(/^quote-item-\d+$/);
    expect(after.map((r) => r.getAttribute('data-quote-item-id'))).toEqual(['a', 'b']);
  });

  it('o componente não importa @dnd-kit (gate estático contra regressão)', () => {
    const source = readFileSync(
      resolve(__dirname, '..', 'DraggableQuoteItems.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/@dnd-kit\//);
    expect(source).not.toMatch(/useSortable|DndContext|DragOverlay|SortableContext/);
    expect(source).not.toMatch(/GripVertical/);
  });

  it('renderiza estado vazio quando items=[]', () => {
    renderList({ items: [] });
    expect(screen.getByTestId('quote-items-empty')).toBeInTheDocument();
  });
});

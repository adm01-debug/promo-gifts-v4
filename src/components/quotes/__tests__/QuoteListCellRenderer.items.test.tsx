/**
 * Cobertura do case 'items' do renderQuoteCell:
 *  - badge circular com count correto por quote.id
 *  - badge exibe "0" enquanto itemCountById carrega (loading)
 *  - badge atualiza para o valor real quando o map chega
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderQuoteCell } from '@/components/quotes/QuoteListCellRenderer';
import type { Quote } from '@/hooks/quotes';

const q = (id: string): Quote =>
  ({
    id,
    quote_number: `ORC-${id}`,
    client_name: 'C',
    client_company: 'E',
    status: 'pending',
    total: 0,
    created_at: '2026-01-01T00:00:00Z',
  }) as Quote;

function renderItems(
  quote: Quote,
  counts?: Record<string, number>,
  loading?: boolean,
) {
  return render(
    <TooltipProvider>
      <div data-testid={`cell-${quote.id}`}>
        {renderQuoteCell(quote, 'items', vi.fn(), undefined, false, counts, loading)}
      </div>
    </TooltipProvider>,
  );
}

describe('renderQuoteCell — case items', () => {
  it('exibe a contagem correta para cada quote.id', () => {
    const counts = { 'q-1': 3, 'q-2': 7 };
    const { rerender } = renderItems(q('q-1'), counts);
    expect(within(screen.getByTestId('cell-q-1')).getByText('3')).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <div data-testid="cell-q-2">
          {renderQuoteCell(q('q-2'), 'items', vi.fn(), undefined, false, counts, false)}
        </div>
      </TooltipProvider>,
    );
    expect(within(screen.getByTestId('cell-q-2')).getByText('7')).toBeInTheDocument();
  });

  it('mostra "0" enquanto isItemCountsLoading e atualiza depois', () => {
    const { rerender } = renderItems(q('q-1'), undefined, true);
    expect(within(screen.getByTestId('cell-q-1')).getByText('0')).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <div data-testid="cell-q-1">
          {renderQuoteCell(q('q-1'), 'items', vi.fn(), undefined, false, { 'q-1': 5 }, false)}
        </div>
      </TooltipProvider>,
    );
    expect(within(screen.getByTestId('cell-q-1')).getByText('5')).toBeInTheDocument();
  });

  it('renderiza badge circular (rounded-full) com ring sutil', () => {
    renderItems(q('q-1'), { 'q-1': 2 });
    const badge = within(screen.getByTestId('cell-q-1')).getByText('2');
    expect(badge.className).toMatch(/rounded-full/);
    expect(badge.className).toMatch(/ring-1/);
  });
});

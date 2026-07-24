/**
 * Casos de borda do badge de Itens:
 *  - itemCountById === undefined  → "0"
 *  - count === null               → "0"
 *  - count === 0                  → "0"
 *  - count muito grande (9999)    → renderiza valor completo, mantém formato circular
 *  - quote.id ausente             → "0"
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderQuoteCell } from '@/components/quotes/QuoteListCellRenderer';
import type { Quote } from '@/hooks/quotes';

const q = (id?: string): Quote =>
  ({
    id,
    quote_number: 'ORC-X',
    client_name: 'C',
    client_company: 'E',
    status: 'pending',
    total: 0,
    created_at: '2026-01-01T00:00:00Z',
  }) as Quote;

function renderItems(
  quote: Quote,
  counts?: Record<string, number | null | undefined>,
) {
  return render(
    <TooltipProvider>
      <div data-testid="cell">
        {renderQuoteCell(
          quote,
          'items',
          vi.fn(),
          undefined,
          false,
          counts as Record<string, number> | undefined,
          false,
        )}
      </div>
    </TooltipProvider>,
  );
}

const badgeOf = () => within(screen.getByTestId('cell')).getByText(/^\d+$/);

describe('renderQuoteCell — case items (edge cases)', () => {
  it('itemCountById undefined → exibe "0"', () => {
    renderItems(q('q-1'), undefined);
    expect(badgeOf().textContent).toBe('0');
  });

  it('count null → exibe "0" (coerção pelo ?? 0)', () => {
    renderItems(q('q-1'), { 'q-1': null });
    expect(badgeOf().textContent).toBe('0');
  });

  it('count 0 explícito → exibe "0"', () => {
    renderItems(q('q-1'), { 'q-1': 0 });
    expect(badgeOf().textContent).toBe('0');
  });

  it('count muito grande (9999) → renderiza valor completo mantendo formato circular', () => {
    renderItems(q('q-1'), { 'q-1': 9999 });
    const badge = badgeOf();
    expect(badge.textContent).toBe('9999');
    expect(badge.className).toMatch(/rounded-full/);
    // `min-w-6` + `px-2` permite expansão sem perder o formato pílula/círculo.
    expect(badge.className).toMatch(/min-w-6/);
  });

  it('quote.id ausente → fallback para "0" sem crash', () => {
    renderItems(q(undefined), { 'q-1': 5 });
    expect(badgeOf().textContent).toBe('0');
  });
});

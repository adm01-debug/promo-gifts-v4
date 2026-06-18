/**
 * Garante que clicar em "Busca" seguido de Reset zera o estado
 * `isSearching` e remove `aria-busy="true"` imediatamente, sem
 * deixar o botão travado em "Buscando…" / spinner.
 *
 * Regression guard do race condition Busca → Reset.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { StockFilterToolbar } from '@/components/inventory/StockFilterToolbar';
import { defaultStockFilters } from '@/types/stock';

const baseProps = {
  filters: { ...defaultStockFilters },
  onUpdateFilter: vi.fn(),
  onResetFilters: vi.fn(),
  categories: [],
  suppliers: [],
  colors: [],
  colorGroups: [],
  totalProducts: 100,
  filteredCount: 100,
};

describe('StockFilterToolbar — handleReset cancela isSearching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aria-busy alterna "false"→"true"→"false" em Busca + Reset', async () => {
    render(<StockFilterToolbar {...baseProps} />);

    const input = screen.getByPlaceholderText(/Buscar no Estoque/i);
    const searchBtn = screen.getByTestId('stock-search-button');

    // Estado inicial: aria-busy="false".
    expect(searchBtn).toHaveAttribute('aria-busy', 'false');

    fireEvent.change(input, { target: { value: 'caneca azul' } });
    expect(searchBtn).toBeEnabled();

    fireEvent.click(searchBtn);

    // Transição 1: false → true.
    await waitFor(() => {
      expect(searchBtn).toHaveAttribute('aria-busy', 'true');
    });
    expect(screen.getByText(/Buscando…/i)).toBeInTheDocument();

    // Reset rápido via X do input.
    const clearXInsideInput = screen.getByRole('button', { name: /Limpar busca/i });
    act(() => {
      fireEvent.click(clearXInsideInput);
    });

    // Transição 2: true → false (sem esperar fallback de 600ms).
    await waitFor(() => {
      expect(searchBtn).toHaveAttribute('aria-busy', 'false');
    });
    expect(screen.queryByText(/Buscando…/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Busca$/)).toBeInTheDocument();
  });

  it('Reset via prop (handleReset) também limpa o spinner sem esperar 600ms', async () => {
    const onResetFilters = vi.fn();
    const { rerender } = render(
      <StockFilterToolbar {...baseProps} onResetFilters={onResetFilters} />,
    );

    const input = screen.getByPlaceholderText(/Buscar no Estoque/i);
    const searchBtn = screen.getByTestId('stock-search-button');

    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.click(searchBtn);
    await waitFor(() => expect(searchBtn).toHaveAttribute('aria-busy', 'true'));

    // Simula reset externo: pai zera filters.search e re-renderiza.
    rerender(
      <StockFilterToolbar
        {...baseProps}
        filters={{ ...defaultStockFilters, search: '' }}
        onResetFilters={onResetFilters}
      />,
    );

    await waitFor(() => {
      expect(searchBtn).toHaveAttribute('aria-busy', 'false');
    });
  });
});

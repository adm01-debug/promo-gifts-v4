/**
 * Field-order regression: o filtro "Preciso de X un..." (quantidade) deve
 * aparecer ANTES do campo de busca "Buscar no Estoque...". Cobre a troca
 * solicitada pelo PO em 2026-06-16.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  totalProducts: 0,
  filteredCount: 0,
};

describe('StockFilterToolbar — ordem dos campos', () => {
  it('renderiza "Preciso de X un..." antes de "Buscar no Estoque..."', () => {
    render(<StockFilterToolbar {...baseProps} />);
    const qty = screen.getByPlaceholderText(/Preciso de X un/i);
    const search = screen.getByPlaceholderText(/Buscar no Estoque/i);
    expect(qty).toBeInTheDocument();
    expect(search).toBeInTheDocument();
    // DOCUMENT_POSITION_FOLLOWING = 4 → search vem depois de qty.
    const pos = qty.compareDocumentPosition(search);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('mantém ordem estável em re-renders repetidos (sanidade)', () => {
    for (let i = 0; i < 30; i++) {
      const { unmount } = render(<StockFilterToolbar {...baseProps} />);
      const qty = screen.getAllByPlaceholderText(/Preciso de X un/i).pop()!;
      const search = screen.getAllByPlaceholderText(/Buscar no Estoque/i).pop()!;
      expect(qty.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      unmount();
    }
  }, 15000);
});

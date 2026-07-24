import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StockEmptyFiltersHint } from '../StockEmptyFiltersHint';
import { defaultStockFilters, type StockFilters } from '@/types/stock';

const makeFilters = (over: Partial<StockFilters> = {}): StockFilters => ({
  ...defaultStockFilters,
  ...over,
});

describe('StockEmptyFiltersHint', () => {
  it('returns null (renders nothing) when no active filters', () => {
    const { container } = render(
      <StockEmptyFiltersHint
        filters={makeFilters()}
        totalProducts={100}
        onResetFilters={vi.fn()}
        onUpdateFilter={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders hint with total and reset button when a filter is active', () => {
    render(
      <StockEmptyFiltersHint
        filters={makeFilters({ search: 'caneca' })}
        totalProducts={1234}
        onResetFilters={vi.fn()}
        onUpdateFilter={vi.fn()}
      />,
    );
    expect(screen.getByTestId('stock-empty-filters-hint')).toBeInTheDocument();
    expect(screen.getByText(/0 de 1\.234 produtos/)).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-reset')).toBeInTheDocument();
  });

  it('fires onResetFilters when reset button clicked', () => {
    const onReset = vi.fn();
    render(
      <StockEmptyFiltersHint
        filters={makeFilters({ search: 'x' })}
        totalProducts={10}
        onResetFilters={onReset}
        onUpdateFilter={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('stock-empty-filters-reset'));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('renders a chip per active filter', () => {
    render(
      <StockEmptyFiltersHint
        filters={makeFilters({
          search: 'busca',
          categoryId: 'cat-1',
          supplierId: 'sup-1',
          colorGroup: 'Azuis',
          colorName: 'Azul Marinho',
          minQuantityNeeded: 5,
          status: 'low_stock',
          showOnlyWithAlerts: true,
        })}
        totalProducts={50}
        onResetFilters={vi.fn()}
        onUpdateFilter={vi.fn()}
      />,
    );
    expect(screen.getByTestId('stock-empty-filters-chip-search')).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-chip-categoryId')).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-chip-supplierId')).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-chip-colorGroup')).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-chip-colorName')).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-chip-minQuantityNeeded')).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-chip-status')).toBeInTheDocument();
    expect(screen.getByTestId('stock-empty-filters-chip-showOnlyWithAlerts')).toBeInTheDocument();
    expect(screen.getByText(/≥ 5 un/)).toBeInTheDocument();
  });

  it('removes status filter by resetting to "all"', () => {
    const onUpdate = vi.fn();
    render(
      <StockEmptyFiltersHint
        filters={makeFilters({ status: 'low_stock' })}
        totalProducts={50}
        onResetFilters={vi.fn()}
        onUpdateFilter={onUpdate}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remover filtro Status'));
    expect(onUpdate).toHaveBeenCalledWith('status', 'all');
  });

  it('removes showOnlyWithAlerts by setting false', () => {
    const onUpdate = vi.fn();
    render(
      <StockEmptyFiltersHint
        filters={makeFilters({ showOnlyWithAlerts: true })}
        totalProducts={50}
        onResetFilters={vi.fn()}
        onUpdateFilter={onUpdate}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remover filtro Alertas'));
    expect(onUpdate).toHaveBeenCalledWith('showOnlyWithAlerts', false);
  });

  it('removes search by setting empty string', () => {
    const onUpdate = vi.fn();
    render(
      <StockEmptyFiltersHint
        filters={makeFilters({ search: 'abc' })}
        totalProducts={50}
        onResetFilters={vi.fn()}
        onUpdateFilter={onUpdate}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remover filtro Busca'));
    expect(onUpdate).toHaveBeenCalledWith('search', '');
  });

  it('removes a generic filter (categoryId) by setting undefined', () => {
    const onUpdate = vi.fn();
    render(
      <StockEmptyFiltersHint
        filters={makeFilters({ categoryId: 'cat-1' })}
        totalProducts={50}
        onResetFilters={vi.fn()}
        onUpdateFilter={onUpdate}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remover filtro Categoria'));
    expect(onUpdate).toHaveBeenCalledWith('categoryId', undefined);
  });
});

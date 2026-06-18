import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StockBulkActionBar } from '../StockBulkActionBar';

const setup = (over: Partial<React.ComponentProps<typeof StockBulkActionBar>> = {}) => {
  const props = {
    selectedCount: over.selectedCount ?? 2,
    totalCount: over.totalCount ?? 10,
    onSelectAll: over.onSelectAll ?? vi.fn(),
    onClear: over.onClear ?? vi.fn(),
    onBulkFavorite: over.onBulkFavorite ?? vi.fn(),
    onBulkCompare: over.onBulkCompare ?? vi.fn(),
    onBulkQuote: over.onBulkQuote ?? vi.fn(),
    onBulkCollection: over.onBulkCollection ?? vi.fn(),
  };
  render(<StockBulkActionBar {...props} />);
  return props;
};

describe('StockBulkActionBar', () => {
  it('renders the region and selected/total count', () => {
    setup({ selectedCount: 3, totalCount: 12 });
    expect(
      screen.getByRole('region', { name: 'Barra de ações em lote do estoque' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3/12')).toBeInTheDocument();
  });

  it('shows "itens selecionados" when more than one item', () => {
    setup({ selectedCount: 5 });
    expect(screen.getByText('itens selecionados')).toBeInTheDocument();
  });

  it('shows "item selecionado" when exactly one item', () => {
    setup({ selectedCount: 1 });
    expect(screen.getByText('item selecionado')).toBeInTheDocument();
  });

  it('shows the prompt to select when nothing selected', () => {
    setup({ selectedCount: 0 });
    expect(screen.getByText('Selecione variações para agir em lote')).toBeInTheDocument();
  });

  it('disables bulk action buttons when nothing is selected', () => {
    setup({ selectedCount: 0 });
    expect(screen.getByTestId('stock-bulk-favorite')).toBeDisabled();
    expect(screen.getByTestId('stock-bulk-compare')).toBeDisabled();
    expect(screen.getByTestId('stock-bulk-collection')).toBeDisabled();
    expect(screen.getByTestId('stock-bulk-quote')).toBeDisabled();
    // select-all and clear are always enabled
    expect(screen.getByTestId('stock-bulk-select-all')).not.toBeDisabled();
    expect(screen.getByTestId('stock-bulk-clear')).not.toBeDisabled();
  });

  it('enables bulk action buttons when items are selected', () => {
    setup({ selectedCount: 2 });
    expect(screen.getByTestId('stock-bulk-favorite')).not.toBeDisabled();
    expect(screen.getByTestId('stock-bulk-quote')).not.toBeDisabled();
  });

  it('fires onSelectAll when "Selecionar visíveis" clicked', () => {
    const props = setup();
    fireEvent.click(screen.getByTestId('stock-bulk-select-all'));
    expect(props.onSelectAll).toHaveBeenCalledOnce();
  });

  it('fires onBulkFavorite, onBulkCompare, onBulkCollection, onBulkQuote', () => {
    const props = setup();
    fireEvent.click(screen.getByTestId('stock-bulk-favorite'));
    fireEvent.click(screen.getByTestId('stock-bulk-compare'));
    fireEvent.click(screen.getByTestId('stock-bulk-collection'));
    fireEvent.click(screen.getByTestId('stock-bulk-quote'));
    expect(props.onBulkFavorite).toHaveBeenCalledOnce();
    expect(props.onBulkCompare).toHaveBeenCalledOnce();
    expect(props.onBulkCollection).toHaveBeenCalledOnce();
    expect(props.onBulkQuote).toHaveBeenCalledOnce();
  });

  it('fires onClear when the close button clicked', () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText('Sair do modo seleção'));
    expect(props.onClear).toHaveBeenCalledOnce();
  });
});

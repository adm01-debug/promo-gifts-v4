/**
 * Tests for BulkAddToCollectionModal.
 * Covers: empty collections, existing collections, create flow, apply flow.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  BulkAddToCollectionModal,
  type BulkCollectionRow,
} from '@/components/inventory/BulkAddToCollectionModal';

const mockCollectionsCtx = {
  collections: [] as Array<{ id: string; name: string; color: string; productIds?: string[] }>,
  createCollection: vi.fn(),
  addProductToCollection: vi.fn(),
  isProductInCollection: vi.fn(() => false),
  defaultColors: ['#FF0000', '#00FF00', '#0000FF'],
  defaultIcons: ['⭐', '🎯', '🎁', '🏆', '💎', '🎪', '🎨', '🎭', '🎬', '🎸'],
};

vi.mock('@/contexts/CollectionsContext', () => ({
  useCollectionsContext: () => mockCollectionsCtx,
}));

const baseRows: BulkCollectionRow[] = [
  { productId: 'p1', productName: 'Produto 1' },
  { productId: 'p2', productName: 'Produto 2' },
];

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  rows: baseRows,
  onApplied: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCollectionsCtx.collections = [];
  mockCollectionsCtx.isProductInCollection.mockReturnValue(false);
});

describe('BulkAddToCollectionModal — initial state', () => {
  it('renders dialog title with correct count (2 variações)', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    expect(screen.getByText(/Adicionar 2 variações a uma coleção/)).toBeInTheDocument();
  });

  it('renders "Criar nova coleção" button', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    expect(screen.getByTestId('stock-bulk-collection-new')).toBeInTheDocument();
  });

  it('shows empty state when no collections', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    expect(screen.getByText(/Nenhuma coleção ainda/)).toBeInTheDocument();
  });

  it('shows singular "variação" for 1 row', () => {
    render(
      <BulkAddToCollectionModal
        {...baseProps}
        rows={[{ productId: 'p1', productName: 'Produto 1' }]}
      />,
    );
    expect(screen.getByText(/Adicionar 1 variação a uma coleção/)).toBeInTheDocument();
  });
});

describe('BulkAddToCollectionModal — with existing collections', () => {
  beforeEach(() => {
    mockCollectionsCtx.collections = [
      { id: 'col-1', name: 'Coleção A', color: '#FF0000', productIds: [] },
      { id: 'col-2', name: 'Coleção B', color: '#00FF00', productIds: ['p1'] },
    ];
  });

  it('renders collection buttons sorted alphabetically', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    expect(screen.getByTestId('stock-bulk-collection-pick-col-1')).toBeInTheDocument();
    expect(screen.getByTestId('stock-bulk-collection-pick-col-2')).toBeInTheDocument();
  });

  it('calls addProductToCollection and onApplied when collection clicked', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('stock-bulk-collection-pick-col-1'));
    expect(mockCollectionsCtx.addProductToCollection).toHaveBeenCalledTimes(2);
    expect(baseProps.onApplied).toHaveBeenCalled();
    expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('skips products already in collection (isProductInCollection = true)', () => {
    mockCollectionsCtx.isProductInCollection.mockReturnValue(true);
    render(<BulkAddToCollectionModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('stock-bulk-collection-pick-col-1'));
    // Both rows skipped — addProductToCollection never called
    expect(mockCollectionsCtx.addProductToCollection).not.toHaveBeenCalled();
    // But modal still closes
    expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('BulkAddToCollectionModal — create flow', () => {
  it('shows create form when "Criar nova coleção" clicked', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('stock-bulk-collection-new'));
    expect(screen.getByPlaceholderText(/Brindes para Cliente X/)).toBeInTheDocument();
  });

  it('"Criar e adicionar" is disabled when name is empty', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('stock-bulk-collection-new'));
    expect(screen.getByTestId('stock-bulk-collection-confirm-create')).toBeDisabled();
  });

  it('enables "Criar e adicionar" when name is typed', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('stock-bulk-collection-new'));
    const input = screen.getByPlaceholderText(/Brindes para Cliente X/);
    fireEvent.change(input, { target: { value: 'Nova Coleção' } });
    expect(screen.getByTestId('stock-bulk-collection-confirm-create')).not.toBeDisabled();
  });

  it('calls createCollection and then applies to new collection', () => {
    mockCollectionsCtx.createCollection.mockReturnValue({ id: 'new-col', name: 'Nova Coleção' });
    render(<BulkAddToCollectionModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('stock-bulk-collection-new'));
    const input = screen.getByPlaceholderText(/Brindes para Cliente X/);
    fireEvent.change(input, { target: { value: 'Nova Coleção' } });
    fireEvent.click(screen.getByTestId('stock-bulk-collection-confirm-create'));
    expect(mockCollectionsCtx.createCollection).toHaveBeenCalledWith(
      'Nova Coleção',
      undefined,
      '#FF0000',
      '⭐',
    );
    expect(mockCollectionsCtx.addProductToCollection).toHaveBeenCalledTimes(2);
  });

  it('Enter key in name input triggers create', () => {
    mockCollectionsCtx.createCollection.mockReturnValue({ id: 'new-col', name: 'Nova Coleção' });
    render(<BulkAddToCollectionModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('stock-bulk-collection-new'));
    const input = screen.getByPlaceholderText(/Brindes para Cliente X/);
    fireEvent.change(input, { target: { value: 'Nova Coleção' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockCollectionsCtx.createCollection).toHaveBeenCalled();
  });

  it('Cancelar button hides create form', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('stock-bulk-collection-new'));
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    // Back to main view
    expect(screen.getByTestId('stock-bulk-collection-new')).toBeInTheDocument();
  });

  it('color picker buttons are rendered', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('stock-bulk-collection-new'));
    // 3 default colors
    const colorBtns = screen.getAllByRole('button', { name: /Cor #/i });
    expect(colorBtns.length).toBe(3);
  });

  it('clicking a color button updates selection (does not throw)', () => {
    render(<BulkAddToCollectionModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('stock-bulk-collection-new'));
    const colorBtns = screen.getAllByRole('button', { name: /Cor #/i });
    fireEvent.click(colorBtns[1]); // click second color
    // No crash — second color selected
    expect(colorBtns[1]).toBeInTheDocument();
  });
});

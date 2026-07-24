import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { BulkAddToCollectionModal, type BulkCollectionRow } from '../BulkAddToCollectionModal';
import type { Collection } from '@/hooks/collections';

// ── Mocks ────────────────────────────────────────────────────────
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const createCollection = vi.fn();
const addProductToCollection = vi.fn();
const isProductInCollection = vi.fn();

const ctx = {
  collections: [] as Collection[],
  createCollection,
  addProductToCollection,
  isProductInCollection,
  defaultColors: ['#8B5CF6', '#EF4444', '#10B981'],
  defaultIcons: ['📁', '⭐', '🎁', '📦'],
};

vi.mock('@/contexts/CollectionsContext', () => ({
  useCollectionsContext: () => ctx,
}));

// Radix Dialog precisa destes stubs no jsdom.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = vi.fn(() => false);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.scrollIntoView = vi.fn();
});

const collection = (over: Partial<Collection> & { id: string; name: string }): Collection => ({
  description: undefined,
  color: '#8B5CF6',
  icon: '📁',
  isFeatured: false,
  productIds: [],
  productItems: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...over,
});

const rows: BulkCollectionRow[] = [
  { productId: 'p1', productName: 'Caneca' },
  { productId: 'p2', productName: 'Caneta' },
];

beforeEach(() => {
  vi.clearAllMocks();
  ctx.collections = [];
  // Re-estabelece implementações (clearAllMocks limpa chamadas, não o impl).
  addProductToCollection.mockReset();
  isProductInCollection.mockReset();
  isProductInCollection.mockReturnValue(false);
  createCollection.mockReset();
  createCollection.mockImplementation((name: string) => ({ id: 'new-col', name }));
});

describe('BulkAddToCollectionModal', () => {
  it('não renderiza quando open=false', () => {
    render(<BulkAddToCollectionModal open={false} onOpenChange={vi.fn()} rows={rows} />);
    expect(screen.queryByTestId('stock-bulk-collection-modal')).not.toBeInTheDocument();
  });

  it('renderiza título plural com a contagem de variações', () => {
    render(<BulkAddToCollectionModal open onOpenChange={vi.fn()} rows={rows} />);
    expect(screen.getByText('Adicionar 2 variações a uma coleção')).toBeInTheDocument();
  });

  it('renderiza título singular quando há apenas 1 linha', () => {
    render(<BulkAddToCollectionModal open onOpenChange={vi.fn()} rows={[rows[0]]} />);
    expect(screen.getByText('Adicionar 1 variação a uma coleção')).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há coleções', () => {
    render(<BulkAddToCollectionModal open onOpenChange={vi.fn()} rows={rows} />);
    expect(screen.getByText(/Nenhuma coleção ainda/)).toBeInTheDocument();
  });

  it('lista coleções existentes ordenadas por nome', () => {
    ctx.collections = [
      collection({ id: 'c2', name: 'Zebra' }),
      collection({ id: 'c1', name: 'Abacaxi' }),
    ];
    render(<BulkAddToCollectionModal open onOpenChange={vi.fn()} rows={rows} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Abacaxi');
    expect(items[1]).toHaveTextContent('Zebra');
  });

  it('ao escolher uma coleção, adiciona todas as linhas e fecha o modal', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onApplied = vi.fn();
    ctx.collections = [collection({ id: 'c1', name: 'Brindes' })];
    render(
      <BulkAddToCollectionModal
        open
        onOpenChange={onOpenChange}
        rows={rows}
        onApplied={onApplied}
      />,
    );
    await user.click(screen.getByTestId('stock-bulk-collection-pick-c1'));

    expect(addProductToCollection).toHaveBeenCalledTimes(2);
    expect(addProductToCollection).toHaveBeenCalledWith('c1', 'p1', undefined);
    expect(addProductToCollection).toHaveBeenCalledWith('c1', 'p2', undefined);
    expect(toastSuccess).toHaveBeenCalled();
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('pula linhas já presentes na coleção (skipped) e adiciona somente as novas', async () => {
    const user = userEvent.setup();
    ctx.collections = [collection({ id: 'c1', name: 'Brindes' })];
    isProductInCollection.mockImplementation((pid: string) => pid === 'p1');
    render(<BulkAddToCollectionModal open onOpenChange={vi.fn()} rows={rows} />);
    await user.click(screen.getByTestId('stock-bulk-collection-pick-c1'));
    expect(addProductToCollection).toHaveBeenCalledTimes(1);
    expect(addProductToCollection).toHaveBeenCalledWith('c1', 'p2', undefined);
  });

  it('mostra erro (toast) se addProductToCollection lançar', async () => {
    const user = userEvent.setup();
    ctx.collections = [collection({ id: 'c1', name: 'Brindes' })];
    addProductToCollection.mockImplementation(() => {
      throw new Error('boom');
    });
    render(<BulkAddToCollectionModal open onOpenChange={vi.fn()} rows={rows} />);
    await user.click(screen.getByTestId('stock-bulk-collection-pick-c1'));
    expect(toastError).toHaveBeenCalled();
  });

  it('alterna para o modo de criação ao clicar em "Criar nova coleção"', async () => {
    const user = userEvent.setup();
    render(<BulkAddToCollectionModal open onOpenChange={vi.fn()} rows={rows} />);
    await user.click(screen.getByTestId('stock-bulk-collection-new'));
    expect(screen.getByLabelText('Nome da coleção')).toBeInTheDocument();
    // botão confirmar começa desabilitado (nome vazio)
    expect(screen.getByTestId('stock-bulk-collection-confirm-create')).toBeDisabled();
  });

  it('cria nova coleção e aplica as linhas', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    createCollection.mockReturnValue({ id: 'created-1', name: 'Cliente X' });
    render(<BulkAddToCollectionModal open onOpenChange={onOpenChange} rows={rows} />);
    await user.click(screen.getByTestId('stock-bulk-collection-new'));
    await user.type(screen.getByLabelText('Nome da coleção'), 'Cliente X');
    await user.click(screen.getByTestId('stock-bulk-collection-confirm-create'));

    expect(createCollection).toHaveBeenCalledWith('Cliente X', undefined, '#8B5CF6', '📁');
    expect(addProductToCollection).toHaveBeenCalledWith('created-1', 'p1', undefined);
    expect(addProductToCollection).toHaveBeenCalledWith('created-1', 'p2', undefined);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cancela o modo de criação e volta para a lista', async () => {
    const user = userEvent.setup();
    render(<BulkAddToCollectionModal open onOpenChange={vi.fn()} rows={rows} />);
    await user.click(screen.getByTestId('stock-bulk-collection-new'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Nome da coleção')).not.toBeInTheDocument();
    expect(screen.getByTestId('stock-bulk-collection-new')).toBeInTheDocument();
  });

  it('preserva a variação (variant) de cada linha ao adicionar', async () => {
    const user = userEvent.setup();
    ctx.collections = [collection({ id: 'c1', name: 'Brindes' })];
    const variantRows: BulkCollectionRow[] = [
      {
        productId: 'p1',
        productName: 'Caneca',
        variant: { variantId: 'v1', colorName: 'Azul' } as never,
      },
    ];
    render(<BulkAddToCollectionModal open onOpenChange={vi.fn()} rows={variantRows} />);
    await user.click(screen.getByTestId('stock-bulk-collection-pick-c1'));
    expect(addProductToCollection).toHaveBeenCalledWith('c1', 'p1', variantRows[0].variant);
  });
});

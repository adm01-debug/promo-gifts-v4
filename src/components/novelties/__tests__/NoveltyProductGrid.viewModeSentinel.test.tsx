/**
 * Regressão (auditoria Novidades 2026-06-20, P1): o sentinel de scroll infinito
 * "Role para ver mais N novidades" só faz sentido na GRADE virtualizada, onde
 * `visibleCount` pagina o conjunto. Nas views list/table TODOS os filteredProducts
 * são renderizados de uma vez e nada avança `visibleCount` — então o sentinel
 * ficava preso permanentemente (ex.: "mais 5 novidades") mesmo com tudo visível.
 *
 * O fix restringe `hasMore` ao modo grid. Este teste trava o contrato:
 *  - grid (>40 itens): sentinel presente;
 *  - list: sentinel ausente e todos os itens renderizados.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';
import type { NoveltyWithDetails } from '@/hooks/products/useNovelties';
import { NoveltyProductGrid } from '../NoveltyProductGrid';

// 45 novidades → ultrapassa o teto inicial de visibleCount (40), garantindo
// hasMore=true na grade. IDs não-UUID para que useProductsColorsBatch fique
// desabilitado (UUID_RE filtra) e nenhuma query real seja disparada.
const PRODUCTS: NoveltyWithDetails[] = Array.from({ length: 45 }, (_, i) => ({
  novelty_id: `n-${i + 1}`,
  product_id: `p-${i + 1}`,
  product_sku: `SKU-${i + 1}`,
  product_name: `Produto ${i + 1}`,
  product_description: null,
  base_price: 10 + i,
  product_image: null,
  product_set_image: null,
  category_id: 'cat1',
  category_name: 'Categoria A',
  supplier_code: null,
  supplier_id: 'sup1',
  supplier_name: 'Fornecedor A',
  supplier_product_code: null,
  detected_at: new Date(Date.now() - i * 86_400_000).toISOString(),
  expires_at: new Date(Date.now() + 20 * 86_400_000).toISOString(),
  days_remaining: 20,
  days_as_novelty: i,
  status: 'active',
  is_highlighted: false,
  is_active: true,
  stock_quantity: 100,
  min_quantity: 10,
  stock_status: 'in-stock',
}));

vi.mock('@/hooks/products', () => ({
  useNoveltiesWithDetails: vi.fn(() => ({
    data: PRODUCTS,
    isLoading: false,
    isFetching: false,
    error: null,
  })),
  sortNovelties: (arr: NoveltyWithDetails[]) => arr,
  noveltyToProduct: (n: NoveltyWithDetails) => ({
    id: n.product_id,
    name: n.product_name || '',
    price: n.base_price ?? 0,
    sku: n.product_sku || '',
    stock: n.stock_quantity,
    colors: [],
    materials: [],
  }),
  useNoveltiesSelectionMode: vi.fn(() => ({
    selectedIds: new Set(),
    selectedCount: 0,
    toggleSelect: vi.fn(),
    clearSelection: vi.fn(),
    selectAll: vi.fn(),
    selectedProducts: [],
    bulkCartProducts: [],
    wizardSelections: {},
    firstSelectedId: undefined,
    firstSelectedProduct: undefined,
    variantWizardOpen: false,
    setVariantWizardOpen: vi.fn(),
    wizardMode: 'cart',
    handleWizardComplete: vi.fn(),
    cartModalOpen: false,
    setCartModalOpen: vi.fn(),
    collectionModalOpen: false,
    setCollectionModalOpen: vi.fn(),
    handleBulkFavorite: vi.fn(),
    handleBulkCompare: vi.fn(),
    handleBulkCollection: vi.fn(),
    handleBulkCart: vi.fn(),
    handleBulkQuote: vi.fn(),
  })),
}));

// Grade virtualizada: stub simples que apenas lista os produtos recebidos
// (paginados). O sentinel testado NÃO vive aqui — vive no NoveltyProductGrid.
vi.mock('../VirtualizedNoveltyGrid', () => ({
  VirtualizedNoveltyGrid: ({ products }: { products: NoveltyWithDetails[] }) => (
    <div data-testid="mock-virtualized-grid">
      {products.map((p) => (
        <div key={p.novelty_id}>{p.product_name}</div>
      ))}
    </div>
  ),
}));

// List view usa ProductListItem; stub leve renderiza só o nome.
vi.mock('@/components/products/ProductListItem', () => ({
  ProductListItem: ({ product }: { product: { name: string } }) => (
    <div data-testid="list-item">{product.name}</div>
  ),
}));

// Modais/barras pesadas → no-op.
vi.mock('@/components/catalog/BulkVariantWizard', () => ({ BulkVariantWizard: () => null }));
vi.mock('@/components/catalog/BulkAddToCartModal', () => ({ BulkAddToCartModal: () => null }));
vi.mock('@/components/collections/AddToCollectionModal', () => ({
  AddToCollectionModal: () => null,
}));
vi.mock('@/components/products/BulkActionBar', () => ({ BulkActionBar: () => null }));

// O componente consome estes stores via seletor — useFavoritesStore((s) => s.isFavorite).
// O mock precisa APLICAR o seletor; do contrário `isFavorite` recebe o objeto inteiro
// (não a função) e a render do modo list quebra com "isFavorite is not a function".
vi.mock('@/stores/useFavoritesStore', () => {
  const state = { isFavorite: () => false, toggleFavorite: vi.fn() };
  return {
    useFavoritesStore: vi.fn((selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
    ),
  };
});
vi.mock('@/stores/useComparisonStore', () => {
  const state = {
    isInCompare: () => false,
    addToCompare: vi.fn(),
    removeFromCompare: vi.fn(),
    canAddMore: true,
  };
  return {
    useComparisonStore: vi.fn((selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
    ),
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter>
      <TooltipProvider>{children}</TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

describe('NoveltyProductGrid › sentinel "Role para ver mais" por view mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra o sentinel no modo grid quando há mais itens que o visibleCount', () => {
    render(<NoveltyProductGrid />, { wrapper });
    // 45 itens, visibleCount inicial 40 → faltam 5.
    expect(screen.getByText(/Role para ver mais 5 novidades/)).toBeInTheDocument();
  });

  it('NÃO mostra o sentinel no modo list (tudo já renderizado de uma vez)', async () => {
    render(<NoveltyProductGrid />, { wrapper });
    expect(screen.getByText(/Role para ver mais/)).toBeInTheDocument();

    // Abre o popover de layout e troca para "Lista".
    fireEvent.click(screen.getByTestId('layout-popover-trigger'));
    const listBtn = await screen.findByTestId('view-mode-list');
    fireEvent.click(listBtn);

    await waitFor(() => {
      // Todos os 45 itens estão no DOM (list não pagina).
      expect(screen.getAllByTestId('list-item')).toHaveLength(45);
      // E o sentinel desapareceu.
      expect(screen.queryByText(/Role para ver mais/)).toBeNull();
    });
  });
});

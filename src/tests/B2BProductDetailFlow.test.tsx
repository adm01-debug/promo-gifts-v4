import { render, screen, fireEvent } from '@testing-library/react';
import { ProductDetailHero } from '@/pages/products/product-detail/ProductDetailHero';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Product } from '@/hooks/products';

// Configurações de Mock
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAddToActiveCart = vi.fn();

/**
 * FIX 2026-06-15: mock completo de SellerCartContext.
 * ANTES: apenas {activeCart, addToActiveCart} — QuickAddToQuote acessa
 *   carts.length na linha 64 → TypeError: Cannot read properties of undefined.
 * DEPOIS: inclui carts (array com 1 carrinho ativo) e canCreateCart,
 *   satisfazendo todos os accessors de QuickAddToQuote e CartSelectorDialog.
 */
vi.mock('@/contexts/SellerCartContext', () => ({
  useSellerCartContext: () => ({
    activeCart: { id: 'cart-1', company_name: 'Empresa Teste', items: [] },
    activeCartId: 'cart-1',
    carts: [{ id: 'cart-1', company_name: 'Empresa Teste', items: [], status: 'novo' }],
    addToActiveCart: mockAddToActiveCart,
    canCreateCart: true,
    isLoading: false,
    totalItems: 0,
  }),
}));

vi.mock('@/hooks/products', () => ({
  useProductFreshnessOverride: () => ({ data: null }),
  useCategoryIcons: () => ({ data: [] }),
  getCategoryIcon: () => '📦',
  useProductIntelligence: () => ({ badges: [] }),
  useProductIntelligenceBadges: () => ({ badges: [] }),
  noveltyToProduct: vi.fn(),
}));

vi.mock('@/hooks/products/useCategoryIcons', () => ({
  useCategoryIcons: () => ({ data: [] }),
  getCategoryIcon: () => '📦',
}));

vi.mock('@/components/products/SingleVariantPicker', () => ({
  SingleVariantPicker: ({ onSelect }: { onSelect: (v: unknown) => void }) => (
    <button onClick={() => onSelect({ color_name: 'Azul', color_hex: '#00F' })}>
      Mock Variant
    </button>
  ),
}));

const mockProduct: Product = {
  id: 'prod-123',
  name: 'Produto Teste B2B',
  sku: 'SKU-B2B',
  price: 10.5,
  images: ['img1.jpg'],
  colors: [{ name: 'Azul', hex: '#0000FF', group: 'Cores' }],
  stock: 1000,
  minQuantity: 50,
  stockStatus: 'in-stock',
  featured: true,
  newArrival: false,
  onSale: false,
  isKit: false,
  category: { id: 1, name: 'Brindes' },
  category_id: 'cat-uuid-1',
  supplier: { id: 'supp-1', name: 'Fornecedor A' },
  tags: {
    publicoAlvo: ['Executivos'],
    datasComemorativas: [],
    endomarketing: [],
    ramo: [],
    nicho: [],
  },
  priceUpdatedAt: new Date().toISOString(),
  leadTimeDays: 5,
} as unknown as Product;

const queryClient = new QueryClient();

const renderPDP = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <ProductDetailHero
            product={mockProduct}
            id="prod-123"
            selectedVariation={null}
            setSelectedVariation={() => {}}
            isFavorite={false}
            onToggleFavorite={() => {}}
            viewCount={100}
            supplierTrust={null}
            onOpenPackagingModal={() => {}}
            onOpenFutureStock={() => {}}
            onOpenSupplierComparison={() => {}}
          />
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  );
};

describe('B2B Product Detail Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Fluxo 1: Adicionar ao Carrinho (Quick Add)', async () => {
    renderPDP();

    const cartButton = screen.getByText('Carrinho');
    fireEvent.click(cartButton);

    const variantButton = await screen.findByText('Mock Variant');
    fireEvent.click(variantButton);

    const confirmAdd = await screen.findByTestId('product-card-add-to-cart');
    fireEvent.click(confirmAdd);

    // addToActiveCart(item, cartId?) — cartId é undefined quando há 1 carrinho
    // ativo e nenhum seletor é exibido (carts.length não excede 1).
    expect(mockAddToActiveCart).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'prod-123',
        quantity: 50,
        color_name: 'Azul',
      }),
      undefined,
    );
  });

  it('Fluxo 2: Navegação por Categorias', () => {
    renderPDP();
    const categoryBadge = screen.getByText('Brindes');
    fireEvent.click(categoryBadge.parentElement!);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/filtros?categories=cat-uuid-1'),
    );
  });

  it('Fluxo 3: Abrir Modais de Ação Rápida (Preços)', async () => {
    renderPDP();

    const pricesButton = screen.getByText('Preços');
    fireEvent.click(pricesButton);

    const title = await screen.findByText(/Tabela de Preços/i);
    expect(title).toBeDefined();
  });

  it('Fluxo 4: Verificação de Tags e Nichos (Indicação)', async () => {
    renderPDP();

    const indicationButton = screen.getByText('Indicação');
    fireEvent.click(indicationButton);

    const modalTitle = await screen.findByText(/Indicado para/i);
    expect(modalTitle).toBeDefined();
  });
});

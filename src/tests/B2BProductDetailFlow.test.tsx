import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
vi.mock('@/contexts/SellerCartContext', () => ({
  useSellerCartContext: () => ({
    activeCart: { id: 'cart-1', company_name: 'Empresa Teste' },
    addToActiveCart: mockAddToActiveCart,
  }),
}));

vi.mock('@/hooks/products', () => ({
  useProductFreshnessOverride: () => ({ data: null }),
  useProductIntelligenceBadges: () => ({ badges: [] }),
  useCategoryIcons: () => ({ data: [] }),
  getCategoryIcon: () => '📦',
  useProductIntelligence: () => ({ badges: [] }),
  useProductIntelligenceBadges: () => ({ badges: [] }),
}));

vi.mock('@/hooks/products/useCategoryIcons', () => ({
  useCategoryIcons: () => ({ data: [] }),
  getCategoryIcon: () => '📦',
}));

vi.mock('@/components/products/SingleVariantPicker', () => ({
  SingleVariantPicker: ({ onSelect }: { onSelect: (v: any) => void }) => (
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
    nicho: [] 
  },
  priceUpdatedAt: new Date().toISOString(),
  leadTimeDays: 5,
} as any;

const queryClient = new QueryClient();

const renderPDP = (tags = {}) => {
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
            tags={tags}
          />
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
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
    
    const confirmAdd = await screen.findByText(/Adicionar ao Carrinho/i);
    fireEvent.click(confirmAdd);

    expect(mockAddToActiveCart).toHaveBeenCalledWith(expect.objectContaining({
      product_id: 'prod-123',
      quantity: 50,
      color_name: 'Azul'
    }));
  });

  it('Fluxo 2: Navegação por Categorias', () => {
    renderPDP();
    const categoryBadge = screen.getByText('Brindes');
    fireEvent.click(categoryBadge.parentElement!);
    
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/filtros?categories=cat-uuid-1'));
  });

  it('Fluxo 3: Abrir Modais de Ação Rápida (Preços)', async () => {
    renderPDP();
    
    const pricesButton = screen.getByText('Preços');
    fireEvent.click(pricesButton);
    
    const title = await screen.findByText(/Tabela de Preços/i);
    expect(title).toBeDefined();
  });

  it('Fluxo 4: Verificação de Tags e Nichos (Indicação)', async () => {
    // Passando tags explicitamente para habilitar o botão
    renderPDP({ 'Público-Alvo': ['Executivos'] });
    
    const indicationButton = screen.getByText('Indicação');
    expect(indicationButton).not.toBeDisabled();
    
    fireEvent.click(indicationButton);
    
    const modalTitle = await screen.findByText(/Indicado para/i);
    expect(modalTitle).toBeDefined();
  });
});

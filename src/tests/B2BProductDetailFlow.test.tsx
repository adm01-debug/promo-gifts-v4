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

vi.mock('@/hooks/products/useCategoryIcons', () => ({
  useCategoryIcons: () => ({ data: [] }),
  getCategoryIcon: () => '📦',
}));

vi.mock('@/hooks/products', () => ({
  useProductFreshnessOverride: () => ({ data: null }),
  useProductIntelligenceBadges: () => ({ badges: [] }),
}));

const mockProduct: Product = {
  id: 'prod-123',
  name: 'Produto Teste B2B',
  sku: 'SKU-B2B',
  price: 10.5,
  images: ['img1.jpg'],
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
  tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
  priceUpdatedAt: new Date().toISOString(),
  leadTimeDays: 5,
} as any;

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
    </QueryClientProvider>
  );
};

describe('B2B Product Detail Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Fluxo 1: Adicionar ao Carrinho (Quick Add)', async () => {
    renderPDP();
    
    // Abrir o popover de adicionar ao carrinho
    const cartButton = screen.getByText('Carrinho');
    fireEvent.click(cartButton);

    // Selecionar variação (pula se não houver ou seleciona a primeira disponível no mock)
    // No QuickAddToQuote, se não houver SingleVariantPicker com dados, ele mostra o passo 3 direto ou permite avançar
    
    // Verificar se o botão de confirmar no carrinho aparece
    await waitFor(() => {
      expect(screen.getByText('Adicionar ao Carrinho')).toBeDefined();
    });

    const confirmAdd = screen.getByText('Adicionar ao Carrinho');
    fireEvent.click(confirmAdd);

    expect(mockAddToActiveCart).toHaveBeenCalledWith(expect.objectContaining({
      product_id: 'prod-123',
      quantity: 50
    }));
  });

  it('Fluxo 2: Navegação por Categorias', () => {
    renderPDP();
    const categoryBadge = screen.getByText('Brindes');
    fireEvent.click(categoryBadge.parentElement!);
    
    expect(mockNavigate).toHaveBeenCalledWith('/filtros?categories=cat-uuid-1');
  });

  it('Fluxo 3: Abrir Modais de Ação Rápida', () => {
    renderPDP();
    
    // Abrir Modal de Preços
    const pricesButton = screen.getByText('Preços');
    fireEvent.click(pricesButton);
    expect(screen.getByText('Tabela de Preços')).toBeDefined();

    // Fechar e abrir Gravação
    fireEvent.click(screen.getByLabelText('Close')); // Depende do componente Dialog
  });

  it('Fluxo 4: Verificação de Tags e Nichos (Seção Indicação)', () => {
    const productWithTags = {
      ...mockProduct,
      tags: { 
        ...mockProduct.tags, 
        'Público-Alvo': ['Executivos', 'Vendedores'] 
      }
    };
    
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TooltipProvider>
            <ProductDetailHero
              product={productWithTags as any}
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
              tags={{ 'Público-Alvo': ['Executivos', 'Vendedores'] }}
            />
          </TooltipProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    const indicationButton = screen.getByText('Indicação');
    fireEvent.click(indicationButton);
    
    expect(screen.getByText('Indicado para')).toBeDefined();
    expect(screen.getByText('Executivos')).toBeDefined();
  });
});

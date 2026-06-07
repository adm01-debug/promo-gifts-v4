import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from './ProductCard';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProductSelectionStore } from '@/stores/useProductSelectionStore';

// Mock components and hooks
vi.mock('@/components/ui/sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/contexts/SellerCartContext', () => ({
  useSellerCartContext: () => ({
    isInAnyCart: () => false,
    addToCart: vi.fn(),
  }),
}));

vi.mock('@/contexts/CollectionsContext', () => ({
  useCollectionsContext: () => ({
    collections: [],
    addToCollection: vi.fn(),
  }),
}));

vi.mock('@/hooks/ui/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

vi.mock('@/hooks/products/useProductLeafCategories', () => ({
  useLeafCategory: () => ({ id: 'cat-1', name: 'Categoria Teste' }),
}));

// Mock sub-components that are causing issues in test environment
vi.mock('@/components/collections/AddToCollectionModal', () => ({
  AddToCollectionModal: () => <div data-testid="mock-collection-modal" />
}));

vi.mock('@/components/products/ProductQuickView', () => ({
  ProductQuickView: () => <div data-testid="mock-quick-view" />
}));

vi.mock('@/components/products/share/SharePreviewDialog', () => ({
  SharePreviewDialog: () => <div data-testid="mock-share-dialog" />
}));

vi.mock('@/components/products/VariantPickerDialog', () => ({
  VariantPickerDialog: () => <div data-testid="mock-variant-picker" />
}));

vi.mock('@/components/products/QuickAddToQuote', () => ({
  QuickAddToQuote: () => <div data-testid="mock-quick-quote" />
}));

// Mock color matching to simplify logic
vi.mock('@/utils/color-variant-carousel', () => ({
  resolveAllMatchingColors: (colors: any) => colors.map((c: any) => ({
    name: c.name,
    hex: c.hex || '#888',
    image: c.image || '/test.jpg'
  })),
}));

const mockProduct1 = {
  id: 'prod-1',
  name: 'Produto 1',
  sku: 'SKU1',
  price: 100,
  colors: [
    { name: 'Azul', hex: '#0000FF', image: '/azul.jpg' },
    { name: 'Vermelho', hex: '#FF0000', image: '/vermelho.jpg' },
  ],
  images: ['/azul.jpg'],
  supplier: { name: 'Fornecedor 1' },
  stock: 10,
  stockStatus: 'in-stock',
} as any;

const mockProduct2 = {
  id: 'prod-2',
  name: 'Produto 2',
  sku: 'SKU2',
  price: 200,
  colors: [
    { name: 'Verde', hex: '#00FF00', image: '/verde.jpg' },
    { name: 'Amarelo', hex: '#FFFF00', image: '/amarelo.jpg' },
  ],
  images: ['/verde.jpg'],
  supplier: { name: 'Fornecedor 2' },
  stock: 20,
  stockStatus: 'in-stock',
} as any;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

describe('ProductCard Selection Isolation', () => {
  beforeEach(() => {
    useProductSelectionStore.getState().clearSelections();
    vi.clearAllMocks();
    
    // Reset URL
    window.history.replaceState({}, '', '/');
  });

  it('deve isolar a seleção de cor por produto', async () => {
    const { rerender } = render(
      <Wrapper>
        <div data-testid="container">
          <ProductCard product={mockProduct1} />
          <ProductCard product={mockProduct2} />
        </div>
      </Wrapper>
    );

    // Seleciona Vermelho no Produto 1
    // Usamos data-testid que existe no componente ProductColorSwatches
    const colorRed = screen.getByTestId('color-swatch-vermelho');
    
    if (colorRed) {
      fireEvent.click(colorRed);
    }

    // Verifica se Produto 1 reflete a cor selecionada (Vermelho)
    expect(useProductSelectionStore.getState().selectedColors['prod-1']).toBe('Vermelho');
    
    // Verifica se Produto 2 NÃO foi afetado
    expect(useProductSelectionStore.getState().selectedColors['prod-2']).toBeUndefined();
    
    // Verifica se a URL contém o PID correto para isolamento
    const url = new URL(window.location.href);
    expect(url.searchParams.get('cor')).toBe('Vermelho');
    expect(url.searchParams.get('pid')).toBe('prod-1');
  });

  it('deve persistir a cor da URL apenas para o produto correspondente', () => {
    // Simula URL com cor e PID
    window.history.replaceState({}, '', '/?cor=Amarelo&pid=prod-2');

    render(
      <Wrapper>
        <ProductCard product={mockProduct1} />
        <ProductCard product={mockProduct2} />
      </Wrapper>
    );

    // Produto 2 deve carregar "Amarelo" (via URL match PID)
    // Produto 1 deve carregar sua cor default "Azul" (PID não coincide)
    
    // O texto do estoque/preço costuma mostrar o nome da cor selecionada no nosso componente
    expect(screen.getByText('Amarelo')).toBeDefined();
    expect(screen.getByText('Azul')).toBeDefined();
  });
});

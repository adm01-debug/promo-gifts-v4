import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCard } from './ProductCard';
import type { Product } from '@/types/product-catalog';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/hooks/ui/useReducedMotion', () => ({ useReducedMotion: () => false }));
vi.mock('@/hooks/products/useProductLeafCategories', () => ({
  useLeafCategory: () => ({ id: '1', name: 'Cat' }),
}));
vi.mock('@/contexts/SellerCartContext', () => ({
  useSellerCartContext: () => ({ isInAnyCart: () => false, addToCart: vi.fn() }),
}));
vi.mock('@/contexts/CollectionsContext', () => ({
  useCollectionsContext: () => ({ collections: [], addToCollection: vi.fn() }),
}));
vi.mock('@/components/collections/AddToCollectionModal', () => ({
  AddToCollectionModal: () => null,
}));

const mockProduct = {
  id: 'p1',
  name: 'Test Product',
  sku: 'SKU12345',
  price: 100,
  supplier: { name: 'SupplierName' },
  colors: [],
  images: [],
  stock: 10,
  stockStatus: 'in-stock',
} as unknown as Product;

const queryClient = new QueryClient();
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

describe('ProductCard Layout and Typography', () => {
  it('should render supplier and SKU badge with accessible label', () => {
    render(
      <Wrapper>
        <ProductCard product={mockProduct} />
      </Wrapper>,
    );

    const supplier = screen.getByText('SupplierName');
    const sku = screen.getByLabelText('Código do produto: SKU12345');

    expect(supplier).toBeDefined();
    expect(sku).toBeDefined();

    // SKU badge é posicionado absoluto no canto inferior direito da imagem
    const container = sku.parentElement;
    expect(container?.className).toContain('absolute');
    expect(container?.className).toContain('bottom-1.5');
    expect(container?.className).toContain('right-1.5');

    // Fonte atual do SKU badge
    expect(sku.className).toContain('text-[10.5px]');

    // Acessibilidade
    expect(sku.getAttribute('aria-label')).toBe('Código do produto: SKU12345');
  });

  it('mantém offset compacto (-mt-0.5 sm:-mt-1.5) entre badge de categoria e fornecedor', () => {
    render(
      <Wrapper>
        <ProductCard product={mockProduct} />
      </Wrapper>,
    );

    // Linha do fornecedor — wrapper que segura o offset vertical
    const supplierRow = screen.getByText('SupplierName').closest('div.flex')
      ?.parentElement as HTMLElement | null;
    expect(supplierRow).toBeTruthy();
    expect(supplierRow!.className).toContain('-mt-0.5');
    expect(supplierRow!.className).toContain('sm:-mt-1.5');

    // Parent (info section) precisa preservar o ritmo vertical base
    // — gap efetivo entre badges = space-y − mt = 6px em todos os breakpoints
    const infoSection = supplierRow!.parentElement as HTMLElement | null;
    expect(infoSection).toBeTruthy();
    expect(infoSection!.className).toContain('space-y-2');
    expect(infoSection!.className).toContain('sm:space-y-3');
  });

  it('h3 do nome usa line-clamp-2 + overflow-hidden e alturas fixas (1.75rem mobile / 2rem sm+)', () => {
    render(
      <Wrapper>
        <ProductCard product={mockProduct} />
      </Wrapper>,
    );

    const title = screen.getByTestId('product-card-name');
    const cls = title.className;

    // Truncamento em 2 linhas com reticências (line-clamp gera text-overflow: ellipsis)
    expect(cls).toContain('line-clamp-2');
    expect(cls).toContain('overflow-hidden');

    // Alturas exatas de 2 linhas — mobile e sm+
    expect(cls).toContain('min-h-[1.75rem]');
    expect(cls).toContain('max-h-[1.75rem]');
    expect(cls).toContain('sm:min-h-[2rem]');
    expect(cls).toContain('sm:max-h-[2rem]');
  });

  it('nome muito longo permanece dentro do h3 truncado em 2 linhas', () => {
    const longName =
      'Caneta esferográfica premium com clip metálico personalizado, ' +
      'tinta azul de alta durabilidade, ponta fina e acabamento fosco antiderrapante';

    render(
      <Wrapper>
        <ProductCard product={{ ...mockProduct, name: longName } as Product} />
      </Wrapper>,
    );

    const title = screen.getByTestId('product-card-name');
    // O nome completo permanece no DOM (acessibilidade/SEO); o corte visual é via CSS
    expect(title.textContent).toBe(longName);
    expect(title.getAttribute('data-product-name')).toBe(longName);
    // Classes responsáveis pelo "…" na 2ª linha
    expect(title.className).toContain('line-clamp-2');
    expect(title.className).toContain('overflow-hidden');
  });
});




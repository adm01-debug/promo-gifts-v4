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
  });
});


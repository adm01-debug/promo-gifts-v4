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
  it('should have supplier on the left and SKU on the right with correct font size', () => {
    render(
      <Wrapper>
        <ProductCard product={mockProduct} />
      </Wrapper>,
    );

    const supplier = screen.getByText('SupplierName');
    const sku = screen.getByText('SKU12345');

    expect(supplier).toBeDefined();
    expect(sku).toBeDefined();

    // Verificação de ordem visual via classes do container
    const container = sku.parentElement;
    expect(container?.className).toContain('justify-between');

    // O SKU deve ter a classe de fonte aumentada (11.5px mobile / 13.8px desktop)
    expect(sku.className).toContain('text-[11.5px]');
    expect(sku.className).toContain('sm:text-[13.8px]');

    // Verificação de acessibilidade
    expect(sku.getAttribute('aria-label')).toBe('Código do produto: SKU12345');
  });
});

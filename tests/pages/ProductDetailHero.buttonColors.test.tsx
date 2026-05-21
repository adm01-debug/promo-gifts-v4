import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductDetailHero } from '@/pages/products/product-detail/ProductDetailHero';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock components that require complex context or data structures
vi.mock('@/components/products/QuickAddToQuote', () => ({
  QuickAddToQuote: ({ className, labelOverride }: any) => (
    <button className={className} aria-label={labelOverride}>{labelOverride}</button>
  )
}));

vi.mock('@/components/products/ProductCategoryBadges', () => ({
  ProductCategoryBadges: () => <div data-testid="category-badges" />
}));

vi.mock('@/components/products/PriceFreshnessThresholdEditor', () => ({
  PriceFreshnessThresholdEditor: () => null
}));

vi.mock('@/components/products/ProductQuickActions', () => ({
  ProductQuickActions: () => <div data-testid="quick-actions" />
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const mockProduct = {
  id: '123',
  name: 'Produto Teste',
  sku: 'SKU-123',
  price: 10,
  images: ['img.jpg'],
  minQuantity: 1,
  description: 'Desc',
  specifications: {},
  supplier: {
    id: 'sup1',
    name: 'XBZ Brindes'
  },
  categories: [],
  brand: 'Brand',
  colors: [] // Added to prevent map errors
};

describe('ProductDetailHero Button Colors', () => {
  it('should have correct semantic classes for Carrinho and Orçamento buttons', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <ProductDetailHero product={mockProduct as any} id="123" />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    );

    const cartBtn = screen.getByLabelText(/Carrinho/i);
    expect(cartBtn.className).toContain('bg-primary');
    
    const quoteBtn = screen.getByText(/Orçamento/i).closest('button');
    expect(quoteBtn?.className).toContain('bg-success');
  });
});

import { render, screen } from '@testing-library/react';
import { ProductCard } from '../ProductCard';
import { ProductListItem } from '../ProductListItem';
import { EnhancedProductCard } from '../EnhancedProductCard';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Product } from '@/types/product-catalog';
import { vi } from 'vitest';

// Mock problematic components
vi.mock('../ProductCardActions', () => ({
  ProductCardActions: () => <div data-testid="product-card-actions" />
}));

vi.mock('../list-item/ListItemActions', () => ({
  ListItemActions: () => <div data-testid="list-item-actions" />
}));

vi.mock('../../collections/AddToCollectionModal', () => ({
  AddToCollectionModal: () => <div data-testid="add-to-collection-modal" />
}));

vi.mock('../ProductQuickView', () => ({
  ProductQuickView: () => <div data-testid="product-quick-view" />
}));

vi.mock('../share/SharePreviewDialog', () => ({
  SharePreviewDialog: () => <div data-testid="share-preview-dialog" />
}));

vi.mock('../VariantPickerDialog', () => ({
  VariantPickerDialog: () => <div data-testid="variant-picker-dialog" />
}));

const mockProduct: Product = {
  id: '1',
  name: 'Test Product',
  sku: 'SKU-123',
  price: 100,
  images: ['test-image.jpg'],
  og_image_url: 'test-image.jpg',
  stock: 0,
  stockStatus: 'out-of-stock',
  category: { id: 'cat1', name: 'Category 1' },
  supplier: { id: 'sup1', name: 'Supplier 1' },
  colors: [],
  groups: [],
  gender: 'unisex',
  featured: false,
  newArrival: false,
  onSale: false,
  isKit: false,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

describe('Product Stock Status Visuals', () => {
  test('ProductCard shows "Fora de estoque" badge and is not grayed out', () => {
    const { container } = render(
      <Wrapper>
        <ProductCard product={mockProduct} onStatusClick={() => {}} />
      </Wrapper>
    );

    // Verify badge exists
    expect(screen.getByText(/Fora de estoque/i)).toBeInTheDocument();

    // Verify no grayscale or major opacity applied to the card or image
    const article = container.querySelector('article');
    expect(article).not.toHaveClass('grayscale');
    expect(article).not.toHaveClass('opacity-50');
    
    const img = container.querySelector('img');
    expect(img).not.toHaveClass('grayscale');
    expect(img).not.toHaveClass('opacity-50');
  });

  test('ProductListItem shows "Fora de estoque" badge in thumbnail', () => {
    render(
      <Wrapper>
        <ProductListItem product={mockProduct} />
      </Wrapper>
    );

    // Should find the badge in the list item
    expect(screen.getByText(/Fora de estoque/i)).toBeInTheDocument();
  });

  test('EnhancedProductCard shows "Fora de estoque" badge', () => {
    const { container } = render(
      <Wrapper>
        <EnhancedProductCard product={mockProduct as any} />
      </Wrapper>
    );

    expect(screen.getByText(/Fora de estoque/i)).toBeInTheDocument();
    
    // Check it's not grayed out
    const article = container.querySelector('article');
    expect(article).not.toHaveClass('grayscale');
  });
});

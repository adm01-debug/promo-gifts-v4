import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Index from '../pages/Index';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TooltipProvider } from '../components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import React from 'react';

const { mockProducts } = vi.hoisted(() => ({
  mockProducts: [
    {
      id: 'p1',
      name: 'Cheap Product',
      price: 10,
      stock: 100,
      images: [],
      colors: [],
      category_id: '1',
      variations: [],
    },
    {
      id: 'p2',
      name: 'Expensive Product',
      price: 1000,
      stock: 50,
      images: [],
      colors: [],
      category_id: '1',
      variations: [],
    },
    {
      id: 'p3',
      name: 'Medium Product',
      price: 500,
      stock: 200,
      images: [],
      colors: [],
      category_id: '1',
      variations: [],
    },
  ],
}));

// Mock the products hook
vi.mock('@/hooks/products/useProductsLightweight', () => ({
  useProductsCatalog: vi.fn(() => ({
    data: { pages: [{ products: mockProducts, totalEstimate: 3 }] },
    isLoading: false,
    isFetching: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  })),
}));

// Mock components to simplify the tree
vi.mock('@/components/catalog/CatalogContent', () => ({
  CatalogContent: vi.fn(({ paginatedProducts }) => (
    <div data-testid="catalog-content">
      {paginatedProducts.map((p: { id: string; name: string }) => (
        <div key={p.id} data-testid="product-item">
          {p.name}
        </div>
      ))}
    </div>
  )),
}));

vi.mock('@/components/catalog/CatalogHeader', () => ({
  CatalogHeader: () => <div data-testid="catalog-header" />,
}));

vi.mock('@/components/compare/FloatingCompareBar', () => ({
  FloatingCompareBar: () => null,
}));

vi.mock('@/components/catalog/CatalogActiveFilters', () => ({
  CatalogActiveFilters: () => null,
}));

// Mock hooks
vi.mock('@/hooks/products/useCatalogRealStats', () => ({
  useCatalogRealStats: vi.fn(() => ({ data: null })),
}));
vi.mock('@/hooks/products/useColorEnrichment', () => ({
  useColorEnrichment: vi.fn(() => ({ data: new Map() })),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'test-user' } })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/contexts/SellerCartContext', () => ({
  useSellerCartContext: vi.fn(() => ({ items: [] })),
  SellerCartProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/contexts/CollectionsContext', () => ({
  useCollectionsContext: vi.fn(() => ({
    collections: [],
    defaultColors: [],
    defaultIcons: [],
    isProductInCollection: () => false,
  })),
  CollectionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/contexts/ProductsContext', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const ReactMock = require('react');
  const mockValue = {
    registerProducts: vi.fn(),
    products: mockProducts,
    getProductsByIds: vi.fn(() => []),
  };
  const Context = ReactMock.createContext(mockValue);
  return {
    useProductsContext: vi.fn(() => mockValue),
    useProductsContextSafe: vi.fn(() => mockValue),
    ProductsProvider: ({ children }: { children: React.ReactNode }) => (
      <Context.Provider value={mockValue}>{children}</Context.Provider>
    ),
    ProductsContext: Context,
  };
});
vi.mock('@/hooks/favorites', () => ({
  useFavoriteQuickAdd: vi.fn(() => ({ handleQuickAdd: vi.fn() })),
}));
vi.mock('@/hooks/intelligence/useSparklineSales', () => ({
  useSparklineSales: vi.fn(() => ({ data: new Map() })),
  useSparklineData: vi.fn(() => ({ data: [], isLoading: false })),
  SparklineSalesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Catalog Sorting E2E Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    // Radix UI Select requires PointerCapture API which jsdom doesn't implement
    window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    window.HTMLElement.prototype.setPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  it('should reorder products when selecting different sort options', async () => {
    const user = userEvent.setup();
    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <TooltipProvider>
              <Index />
            </TooltipProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>,
    );

    await waitFor(() => expect(screen.getByText('Cheap Product')).toBeDefined());

    const sortTrigger = screen.getByTestId('catalog-sort-trigger');
    await user.click(sortTrigger);

    // label: 'Preço (Menor → Maior)' — value: 'price-asc'
    await waitFor(() => expect(screen.getByTestId('catalog-sort-item-price-asc')).toBeDefined());
    await user.click(screen.getByTestId('catalog-sort-item-price-asc'));

    await waitFor(() => {
      const items = screen.getAllByTestId('product-item').map((i) => i.textContent);
      expect(items[0]).toBe('Cheap Product');
      expect(items[1]).toBe('Medium Product');
      expect(items[2]).toBe('Expensive Product');
    });

    await user.click(screen.getByTestId('catalog-sort-trigger'));
    // label: 'Preço (Maior → Menor)' — value: 'price-desc'
    await waitFor(() => expect(screen.getByTestId('catalog-sort-item-price-desc')).toBeDefined());
    await user.click(screen.getByTestId('catalog-sort-item-price-desc'));

    await waitFor(() => {
      const items = screen.getAllByTestId('product-item').map((i) => i.textContent);
      expect(items[0]).toBe('Expensive Product');
      expect(items[1]).toBe('Medium Product');
      expect(items[2]).toBe('Cheap Product');
    });
  });
});

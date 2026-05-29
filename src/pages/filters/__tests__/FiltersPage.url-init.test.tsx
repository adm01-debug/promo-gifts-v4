import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFiltersPageState } from '../useFiltersPageState';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: vi.fn(),
  };
});

vi.mock('@/hooks/products/useProductsLightweight', () => ({
  useProductsCatalog: vi.fn(({ categories }) => ({
    data: {
      pages: [{
        products: [
          { id: '1', name: 'Product 1', price: 10, category_id: '30', brand: 'Brand A', materials: [], stock: 100 },
          { id: '2', name: 'Product 2', price: 20, category_id: '31', brand: 'Brand B', materials: [], stock: 50 },
        ].filter(p => !categories || categories.length === 0 || categories.includes(p.category_id)),
        totalEstimate: 2
      }]
    },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  })),
}));

vi.mock('@/hooks/products/useProductsByCategory', () => ({
  useProductsByCategory: vi.fn(({ categoryIds }) => {
    const ids = new Set<string>();
    if (categoryIds.includes('30')) ids.add('1');
    if (categoryIds.includes('31')) ids.add('2');
    return {
      productIds: ids,
      hasFilter: categoryIds.length > 0,
      isLoading: false,
      error: null
    };
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('useFiltersPageState - URL Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize filters from categories in URL', () => {
    const mockSearchParams = new URLSearchParams('categories=30');
    (useSearchParams as any).mockReturnValue([mockSearchParams, vi.fn()]);

    const { result } = renderHook(() => useFiltersPageState(), { wrapper });
    
    expect(result.current.filters.categories).toEqual(['30']);
    expect(result.current.filteredProducts.length).toBe(1);
    expect(result.current.filteredProducts[0].id).toBe('1');
  });

  it('should handle multiple categories in URL', () => {
    const mockSearchParams = new URLSearchParams('categories=30,31');
    (useSearchParams as any).mockReturnValue([mockSearchParams, vi.fn()]);

    const { result } = renderHook(() => useFiltersPageState(), { wrapper });
    
    expect(result.current.filters.categories).toEqual(['30', '31']);
    // Both should match since useProductsByCategory returns 1 and 2
    expect(result.current.filteredProducts.length).toBe(2);
  });
});

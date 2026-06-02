import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFiltersPageState } from '../useFiltersPageState';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useProductsCatalog } from '@/hooks/products/useProductsLightweight';
import { SORT_OPTIONS } from '@/constants/filters';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/hooks/products/useProductsLightweight', () => ({
  useProductsCatalog: vi.fn(),
}));

vi.mock('@/hooks/products/useProductsByCategory', () => ({
  useProductsByCategory: vi.fn(() => ({
    productIds: new Set(),
    hasFilter: false,
    isLoading: false,
  })),
}));

vi.mock('@/hooks/products/useProductsByColor', () => ({
  useProductsByColor: vi.fn(() => ({
    productIds: new Set(),
    hasFilter: false,
    isLoading: false,
  })),
}));

vi.mock('@/hooks/products/useProductsByMaterial', () => ({
  useProductsByMaterial: vi.fn(() => ({
    productIds: new Set(),
    hasFilter: false,
    isLoading: false,
  })),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('Catalog Sorting and Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty result set gracefully when sorting returns nothing', () => {
    (useProductsCatalog as any).mockReturnValue({
      data: { pages: [{ products: [], totalEstimate: 0 }] },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    });

    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    expect(result.current.filteredProducts.length).toBe(0);
    expect(result.current.totalEstimate).toBe(0);
  });

  it('should maintain filters when switching sort', () => {
    (useProductsCatalog as any).mockReturnValue({
      data: { pages: [{ products: [], totalEstimate: 0 }] },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    });

    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({ ...result.current.filters, search: 'test query' });
    });

    // Reset mock to ensure we only capture the final call
    (useProductsCatalog as any).mockClear();

    act(() => {
      result.current.setSortBy('price-asc');
    });

    expect(result.current.filters.search).toBe('test query');
    expect(result.current.filters.sortBy).toBe('price-asc');
    
    // Note: useFiltersPageState uses a debounced serverSearchTerm for the hook
    // We check that sortBy is correctly propagated.
    expect(useProductsCatalog).toHaveBeenCalledWith(expect.objectContaining({
      sortBy: 'price-asc'
    }));
  });

  it('should validate that UI sort labels correspond to productService parameters', () => {
    (useProductsCatalog as any).mockReturnValue({
      data: { pages: [{ products: [], totalEstimate: 0 }] },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    });

    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    SORT_OPTIONS.forEach(option => {
      act(() => {
        result.current.setSortBy(option.value);
      });
      
      expect(useProductsCatalog).toHaveBeenLastCalledWith(expect.objectContaining({
        sortBy: option.value
      }));
    });
  });

  it('should handle products with null/missing fields during sorting without crashing', () => {
    const productsWithNulls = [
      { id: '1', name: 'Product A', price: null, stock: null },
      { id: '2', name: null, price: 10, stock: 5 }
    ];

    (useProductsCatalog as any).mockReturnValue({
      data: { pages: [{ products: productsWithNulls, totalEstimate: 2 }] },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    });

    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    // Should not crash even with null fields
    expect(result.current.filteredProducts.length).toBe(2);
  });

  it('should not duplicate items when sort changes with existing results', () => {
    const p1 = { id: '1', name: 'A', price: 10 };
    const p2 = { id: '2', name: 'B', price: 20 };

    (useProductsCatalog as any).mockReturnValue({
      data: { pages: [{ products: [p1, p2], totalEstimate: 2 }] },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    });

    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.setSortBy('price-desc');
    });

    // filteredProducts should still be unique
    const ids = result.current.filteredProducts.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
    expect(ids.length).toBe(2);
  });
});

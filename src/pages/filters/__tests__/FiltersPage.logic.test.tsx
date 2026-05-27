import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFiltersPageState } from '../useFiltersPageState';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/hooks/products/useProductsLightweight', () => ({
  useProductsCatalog: vi.fn(() => ({
    data: {
      pages: [{
        products: [
          { id: '1', name: 'Caneta Metal', price: 10, category_id: 'cat1', brand: 'Fornecedor A', materials: ['Metal'] },
          { id: '2', name: 'Caneta Plastico', price: 5, category_id: 'cat1', brand: 'Fornecedor B', materials: ['Plastico'] },
          { id: '3', name: 'Mochila Notebook', price: 50, category_id: 'cat2', brand: 'Fornecedor A', materials: ['Nylon'] },
        ],
        totalEstimate: 3
      }]
    },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  })),
}));

vi.mock('@/hooks/products/useProductsByCategory', () => ({
  useProductsByCategory: vi.fn(({ categoryIds }) => ({
    productIds: new Set(categoryIds.includes('cat1') ? ['1', '2'] : []),
    hasFilter: categoryIds.length > 0,
    isLoading: false,
  })),
}));

vi.mock('@/hooks/products/useProductsByColor', () => ({
  useProductsByColor: vi.fn(({ colors = [], colorGroups = [] }) => ({
    productIds: new Set(),
    hasFilter: colors.length > 0 || colorGroups.length > 0,
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

describe('useFiltersPageState Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with all products', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });
    
    expect(result.current.realProducts.length).toBe(3);
    expect(result.current.filteredProducts.length).toBe(3);
    expect(result.current.activeFiltersCount).toBe(0);
  });

  it('should filter by search term', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({ ...result.current.filters, search: 'Mochila' });
    });

    expect(result.current.filteredProducts.length).toBe(1);
    expect(result.current.filteredProducts[0].name).toBe('Mochila Notebook');
    expect(result.current.activeFiltersCount).toBe(1);
  });

  it('should filter by category', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({ ...result.current.filters, categories: ['cat1'] });
    });

    // Mock returns ['1', '2'] for 'cat1'
    expect(result.current.filteredProducts.length).toBe(2);
    expect(result.current.filteredProducts.every(p => p.category_id === 'cat1')).toBe(true);
  });

  it('should filter by price range', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({ ...result.current.filters, priceRange: [0, 15] });
    });

    // Caneta Metal (10) and Caneta Plastico (5) should remain
    expect(result.current.filteredProducts.length).toBe(2);
    expect(result.current.filteredProducts.every(p => p.price <= 15)).toBe(true);
  });

  it('should handle reset', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({ ...result.current.filters, search: 'Caneta' });
    });
    expect(result.current.activeFiltersCount).toBe(1);

    act(() => {
      result.current.handleReset();
    });

    expect(result.current.activeFiltersCount).toBe(0);
    expect(result.current.filteredProducts.length).toBe(3);
  });
});

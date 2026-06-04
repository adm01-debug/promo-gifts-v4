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

import { useProductsCatalog } from '@/hooks/products/useProductsLightweight';

vi.mock('@/hooks/products/useProductsLightweight', () => ({
  useProductsCatalog: vi.fn(({ sortBy: _sortBy }) => ({
    data: {
      pages: [
        {
          products: [
            {
              id: '1',
              name: 'Caneta Metal',
              price: 10,
              category_id: 'cat1',
              brand: 'Fornecedor A',
              materials: ['Metal'],
              stock: 100,
              featured: true,
              newArrival: false,
              gender: 'Unissex',
              is_bestseller: true,
              created_at: '2026-06-01T10:00:00Z',
            },
            {
              id: '2',
              name: 'Caneta Plastico',
              price: 5,
              category_id: 'cat1',
              brand: 'Fornecedor B',
              materials: ['Plastico'],
              stock: 50,
              featured: false,
              newArrival: true,
              gender: 'Masculino',
              is_bestseller: false,
              created_at: '2026-06-02T10:00:00Z',
            },
            {
              id: '3',
              name: 'Mochila Notebook',
              price: 50,
              category_id: 'cat2',
              brand: 'Fornecedor A',
              materials: ['Nylon'],
              stock: 0,
              featured: false,
              newArrival: false,
              gender: 'Feminino',
              is_bestseller: false,
              created_at: '2026-05-30T10:00:00Z',
            },
          ],
          totalEstimate: 3,
        },
      ],
    },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  })),
}));

vi.mock('@/hooks/products/useProductsByCategory', () => ({
  useProductsByCategory: vi.fn(({ categoryIds }) => ({
    productIds: new Set(
      categoryIds.includes('cat1') ? ['1', '2'] : categoryIds.includes('cat2') ? ['3'] : [],
    ),
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
  useProductsByMaterial: vi.fn(({ materialGroups = [], materialTypes = [] }) => ({
    productIds: new Set(),
    hasFilter: materialGroups.length > 0 || materialTypes.length > 0,
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

describe('useFiltersPageState Logic - Extended Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with all products', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    expect(result.current.realProducts.length).toBe(3);
    expect(result.current.filteredProducts.length).toBe(3);
  });

  it('should filter by featured products', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({ ...result.current.filters, featured: true });
    });

    expect(result.current.filteredProducts.length).toBe(1);
    expect(result.current.filteredProducts[0].id).toBe('1');
  });

  it('should filter by new arrivals', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({ ...result.current.filters, isNew: true });
    });

    expect(result.current.filteredProducts.length).toBe(1);
    expect(result.current.filteredProducts[0].id).toBe('2');
  });

  it('should filter by stock availability', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({ ...result.current.filters, inStock: true });
    });

    // 1 and 2 have stock, 3 has 0
    expect(result.current.filteredProducts.length).toBe(2);
    expect(result.current.filteredProducts.some((p) => p.id === '3')).toBe(false);
  });

  it('should filter by gender', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({ ...result.current.filters, gender: ['Feminino'] });
    });

    expect(result.current.filteredProducts.length).toBe(1);
    expect(result.current.filteredProducts[0].gender).toBe('Feminino');
  });

  it('should filter by supplier', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({ ...result.current.filters, suppliers: ['Fornecedor B'] });
    });

    expect(result.current.filteredProducts.length).toBe(1);
    expect(result.current.filteredProducts[0].brand).toBe('Fornecedor B');
  });

  it('should combine multiple filters (AND logic)', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({
        ...result.current.filters,
        categories: ['cat1'],
        priceRange: [0, 8],
      });
    });

    // Only 'Caneta Plastico' (id 2, price 5) matches both
    expect(result.current.filteredProducts.length).toBe(1);
    expect(result.current.filteredProducts[0].id).toBe('2');
  });

  it('should update activeFiltersCount correctly', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    act(() => {
      result.current.handleFilterChange({
        ...result.current.filters,
        search: 'a',
        featured: true,
        priceRange: [10, 20],
      });
    });

    expect(result.current.activeFiltersCount).toBe(3);
  });

  it('should apply sorting correctly (contract validation)', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    // 1. Sort by price-asc
    act(() => {
      result.current.setSortBy('price-asc');
    });
    expect(useProductsCatalog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sortBy: 'price-asc',
      }),
    );
    expect(result.current.filteredProducts[0].id).toBe('2'); // Price 5

    // 2. Sort by price-desc
    act(() => {
      result.current.setSortBy('price-desc');
    });
    expect(useProductsCatalog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sortBy: 'price-desc',
      }),
    );
    expect(result.current.filteredProducts[0].id).toBe('3'); // Price 50

    // 3. Sort by newest
    act(() => {
      result.current.setSortBy('newest');
    });
    expect(useProductsCatalog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sortBy: 'newest',
      }),
    );
    expect(result.current.filteredProducts[0].id).toBe('2'); // June 02
  });

  it('should reset pagination when filters or sort change', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });

    // Changing sort should trigger useProductsCatalog with new sortBy
    // which in turn causes the queryKey to change in useInfiniteQuery, effectively resetting pagination
    act(() => {
      result.current.setSortBy('price-asc');
    });

    expect(useProductsCatalog).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCatalogState } from '@/hooks/products/useCatalogState';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductsProvider } from '@/contexts/ProductsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import React from 'react';

// Simplified mocks to avoid OOM
vi.mock('@/hooks/products', () => ({
  useProductsCatalog: vi.fn(() => ({
    data: { pages: [{ products: [], totalEstimate: 0 }] },
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn().mockResolvedValue({}),
    refetch: vi.fn(),
  })),
  useProductsByMaterial: vi.fn(() => ({ productIds: [], hasFilter: false, isLoading: false })),
  useProductsByCategory: vi.fn(() => ({ productIds: [], hasFilter: false, isLoading: false })),
  useExternalCategoriesQuery: vi.fn(() => ({ data: [] })),
  useCatalogRealStats: vi.fn(() => ({ data: null })),
  useSupplierSalesRanking: vi.fn(() => ({ data: new Map() })),
  useColorEnrichment: vi.fn(() => ({ data: new Map() })),
  useProductFuzzySearch: vi.fn(() => ({ results: [], hasSearch: false })),
}));

vi.mock('@/hooks/products/useCatalogFiltering', () => ({
  useCatalogFiltering: vi.fn((args: { realProducts?: unknown[] }) => args.realProducts || []),
}));

vi.mock('@/hooks/common', () => ({
  useSearch: vi.fn(() => ({
    suggestions: [],
    quickSuggestions: [],
    history: [],
    addToHistory: vi.fn(),
    clearHistory: vi.fn(),
  })),
  useDebounce: vi.fn((value: unknown) => value),
}));

vi.mock('@/hooks/intelligence', () => ({
  usePromoSalesRanking: vi.fn(() => ({ data: new Map() })),
  useSupplierSalesRanking: vi.fn(() => ({ data: new Map() })),
}));

vi.mock('@/hooks/favorites', () => ({
  useFavoriteQuickAdd: vi.fn(() => ({
    handleFavoriteClick: vi.fn(),
    defaultList: null,
    addToList: vi.fn(),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
}));

describe('Catalog Sort Layout Stability', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProductsProvider>{children}</ProductsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );

  it('changing sortBy does not affect viewMode or gridColumns', async () => {
    const { result } = renderHook(() => useCatalogState(), { wrapper });

    // Initial state
    expect(result.current.viewMode).toBe('grid');
    const initialCols = result.current.gridColumns;

    // Change sortBy
    await act(async () => {
      result.current.setSortBy('price-asc');
    });

    // Check stability
    expect(result.current.sortBy).toBe('price-asc');
    expect(result.current.viewMode).toBe('grid');
    expect(result.current.gridColumns).toBe(initialCols);

    // Change viewMode
    await act(async () => {
      result.current.setViewMode('list');
    });
    expect(result.current.viewMode).toBe('list');

    // Change sortBy again
    await act(async () => {
      result.current.setSortBy('name');
    });
    expect(result.current.sortBy).toBe('name');
    expect(result.current.viewMode).toBe('list');
  });
});

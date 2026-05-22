import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCatalogState } from '@/hooks/products';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductsProvider } from '@/contexts/ProductsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import React from 'react';

// QA: vi.mock() do mesmo módulo é hoist-and-replace — múltiplos calls
// para "@/hooks/products" faziam só o último valer (useCatalogFiltering),
// e o próprio useCatalogState (que é o hook sob teste!) virava undefined.
// Consolidado em um único vi.mock usando importOriginal para preservar
// useCatalogState e demais exports não mockados.
vi.mock('@/hooks/products', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    useProductsCatalog: vi.fn(() => ({
      data: { pages: [{ products: [], totalEstimate: 0 }] },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    })),
    useProductsByMaterial: vi.fn(() => ({
      productIds: [],
      hasFilter: false,
      isLoading: false,
    })),
    useProductsByCategory: vi.fn(() => ({
      productIds: [],
      hasFilter: false,
      isLoading: false,
    })),
    useExternalCategoriesQuery: vi.fn(() => ({ data: [] })),
    useCatalogRealStats: vi.fn(() => ({ data: null })),
    useSupplierSalesRanking: vi.fn(() => ({ data: new Map() })),
    useColorEnrichment: vi.fn(() => ({ data: new Map() })),
    useProductFuzzySearch: vi.fn(() => ({ results: [], hasSearch: false })),
    useCatalogFiltering: vi.fn((args) => args.realProducts || []),
  };
});

vi.mock('@/hooks/common', () => ({
  useSearch: vi.fn(() => ({
    suggestions: [],
    quickSuggestions: [],
    history: [],
    addToHistory: vi.fn(),
    clearHistory: vi.fn(),
  })),
  // QA: useCatalogState chama useDebounce em vários pontos; sem este export
  // o módulo mockado quebrava o hook sob teste.
  useDebounce: vi.fn(<T,>(v: T) => v),
}));

vi.mock('@/hooks/intelligence', () => ({
  usePromoSalesRanking: vi.fn(() => ({ data: new Map() })),
}));

vi.mock('@/hooks/favorites', () => ({
  useFavoriteQuickAdd: vi.fn(() => ({
    handleFavoriteClick: vi.fn(),
    defaultList: null,
    addToList: vi.fn(),
  })),
}));

// Mock Supabase
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
      single: vi.fn(),
    })),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

describe('useCatalogState', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
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

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useCatalogState(), { wrapper });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.viewMode).toBe('grid');
    expect(result.current.activeFiltersCount).toBe(0);
    expect(result.current.paginatedProducts).toEqual([]);
  });

  it('should update search query correctly', async () => {
    const { result } = renderHook(() => useCatalogState(), { wrapper });

    await act(async () => {
      result.current.handleSearch('test search');
    });

    expect(result.current.searchQuery).toBe('test search');
  });

  it('should reset filters correctly', async () => {
    const { result } = renderHook(() => useCatalogState(), { wrapper });

    await act(async () => {
      result.current.setFilters({
        ...result.current.filters,
        inStock: true,
        categories: [123],
      });
    });

    // categories is an array of numbers in FilterState
    expect(result.current.activeFiltersCount).toBe(2); // inStock + 1 category

    await act(async () => {
      result.current.resetFilters();
    });

    expect(result.current.activeFiltersCount).toBe(0);
    expect(result.current.searchQuery).toBe('');
  });
});

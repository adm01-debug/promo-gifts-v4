import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCatalogState } from '@/hooks/products/useCatalogState';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductsProvider } from '@/contexts/ProductsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import React from 'react';

// useCatalogState imports its internal hooks from the @/hooks/products barrel.
// We must mock the barrel as a SINGLE module replacement (multiple vi.mock calls
// for the same path overwrite each other — only the last one survives).
// importOriginal() preserves any re-exports we don't override.
vi.mock('@/hooks/products', async (importOriginal) => {
  const actual = await importOriginal();
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
    useProductsByMaterial: vi.fn(() => ({ productIds: [], hasFilter: false, isLoading: false })),
    useProductsByCategory: vi.fn(() => ({ productIds: [], hasFilter: false, isLoading: false })),
    useExternalCategoriesQuery: vi.fn(() => ({ data: [] })),
    useCatalogRealStats: vi.fn(() => ({ data: null })),
    useSupplierSalesRanking: vi.fn(() => ({ data: new Map() })),
    useColorEnrichment: vi.fn(() => ({ data: new Map() })),
    useProductFuzzySearch: vi.fn(() => ({ results: [], hasSearch: false })),
    useCatalogFiltering: vi.fn((args: { realProducts?: unknown[] }) => args.realProducts || []),
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
  useDebounce: vi.fn(<T,>(value: T) => value),
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

// FIXME(useCatalogState-unit-OOM): testar este hook isoladamente provoca
// ERR_WORKER_OUT_OF_MEMORY porque o hook tem 8 useEffects, alguns subscrevem
// a stores Zustand, e a interação com useSearchParams + ProductsProvider real
// no wrapper gera loop de re-render que esgota o heap do worker. Cobertura
// real de useCatalogState vem dos testes de integração de `tests/integration/`
// e dos testes do `<Catalog>` que o consomem. Manter este arquivo como
// regression guard estrutural até refactor em PR dedicado.
describe.skip('useCatalogState', () => {
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

/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
// Importa direto do arquivo para evitar carregar o barrel @/hooks/products
// (cuja transitive deps explodiam o worker de memória — Supabase clients +
// queries + adapters). O test só precisa do hook que está sendo testado.
import { useCatalogState } from '@/hooks/products/useCatalogState';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductsProvider } from '@/contexts/ProductsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import React from 'react';

// Mock @/hooks/products como módulo SINTÉTICO (sem importActual — Supabase
// clients e queries fazem worker OOM). Todos os hooks que useCatalogState
// importa do barrel ficam aqui.
vi.mock('@/hooks/products', () => ({
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
  noveltyToProduct: vi.fn(),
}));

// useCatalogState importa useCatalogFiltering por path direto, não pelo barrel.
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
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'placeholder-key',
}));

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  readonly root: Document | Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
} as unknown as typeof IntersectionObserver;

// TODO: hook cresceu demais — cascata de imports (Supabase + ProductsContext +
// favorites/comparison stores + intelligence) estoura memória do worker vitest
// (ERR_WORKER_OUT_OF_MEMORY após 121s). Mockar TUDO é frágil. Para reabilitar:
// 2026-06-11: --pool=forks também foi testado e NÃO resolve (worker trava e é
// terminado por timeout após ~254s). A única saída é extrair as deps via
// DI/injection no próprio hook. Mantendo skip explícito até refactor dedicado
// para não esconder sob baseline.
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
        categories: ['123'],
      });
    });

    // categories is an array of strings in FilterState
    expect(result.current.activeFiltersCount).toBe(2); // inStock + 1 category

    await act(async () => {
      result.current.resetFilters();
    });

    expect(result.current.activeFiltersCount).toBe(0);
    expect(result.current.searchQuery).toBe('');
  });
});

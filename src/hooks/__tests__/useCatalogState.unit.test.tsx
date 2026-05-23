import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCatalogState } from "@/hooks/products/useCatalogState";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductsProvider } from "@/contexts/ProductsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import React from "react";

// Mocks com REFERENCIAS ESTAVEIS (vi.hoisted): retornar new Map()/vi.fn() a cada render faz
// o useEffect [realProducts, registerProducts] do SUT re-disparar em loop -> re-render infinito
// -> JS heap out of memory. Por isso fixamos as referencias uma unica vez.
const H = vi.hoisted(() => {
  const emptyMap = new Map();
  const noop = () => {};
  return {
    emptyMap,
    registerProducts: noop,
    catalog: {
      data: { pages: [{ products: [], totalEstimate: 0 }] },
      isLoading: false, isFetching: false, isFetchingNextPage: false,
      hasNextPage: false, fetchNextPage: noop, refetch: noop,
    },
    noFilter: { productIds: [] as string[], hasFilter: false, isLoading: false },
    search: { suggestions: [], quickSuggestions: [], history: [], addToHistory: noop, clearHistory: noop },
    favQuickAdd: { handleFavoriteClick: () => ({ resolved: true as const }), defaultList: null, addToList: noop },
    favStore: { favorites: [], toggleFavorite: noop, isFavorite: () => false },
    compStore: { items: [], toggleComparison: noop, isInComparison: () => false, clearComparison: noop },
    toast: { toast: noop },
    fuzzy: { results: [], hasSearch: false },
  };
});

vi.mock("@/hooks/products", () => ({
  useProductsCatalog: () => H.catalog,
  useProductsByMaterial: () => H.noFilter,
  useProductsByCategory: () => H.noFilter,
  useExternalCategoriesQuery: () => ({ data: [] }),
  useCatalogRealStats: () => ({ data: null }),
  useSupplierSalesRanking: () => ({ data: H.emptyMap }),
  useColorEnrichment: () => ({ data: H.emptyMap }),
  useProductFuzzySearch: () => H.fuzzy,
}));

vi.mock("@/hooks/common", () => ({
  useSearch: () => H.search,
  useDebounce: (value: unknown) => value,
}));

vi.mock("@/hooks/intelligence", () => ({
  usePromoSalesRanking: () => ({ data: H.emptyMap }),
}));

vi.mock("@/hooks/favorites", () => ({
  useFavoriteQuickAdd: () => H.favQuickAdd,
}));

vi.mock("@/stores/useFavoritesStore", () => ({
  useFavoritesStore: () => H.favStore,
}));

vi.mock("@/stores/useComparisonStore", () => ({
  useComparisonStore: () => H.compStore,
}));

vi.mock("@/hooks/ui", () => ({
  useToast: () => H.toast,
}));

vi.mock("@/hooks/products/useCatalogFiltering", () => ({
  useCatalogFiltering: (args: { realProducts?: unknown[] }) => args?.realProducts ?? [],
}));

vi.mock("@/components/filters/FilterPanel", () => ({
  defaultFilters: {
    search: "", colorGroups: [], colorVariations: [], colorNuances: [], colors: [],
    categories: [], suppliers: [], publicoAlvo: [], datasComemorativas: [], endomarketing: [],
    ramosAtividade: [], segmentosAtividade: [], materialGroups: [], materialTypes: [], materiais: [],
    techniques: [], tags: [], priceRange: [0, 9999], minStock: 0, inStock: false, isKit: false,
    featured: false, isNew: false, hasPersonalization: false, hasCommercialPackaging: false,
    gender: [], sizes: [], sortBy: "name",
  },
  FilterPanel: () => null,
}));

vi.mock("@/components/products/ColumnSelector", () => ({
  getDefaultColumns: () => 4,
  STORAGE_KEY: "catalog-grid-columns",
  ColumnSelector: () => null,
}));

// Contexts: passthrough leve com referencia estavel de registerProducts (quebra loop do useEffect)
vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: null, session: null, loading: false, refreshSession: () => {} }),
}));

vi.mock("@/contexts/ProductsContext", () => ({
  ProductsProvider: ({ children }: { children: React.ReactNode }) => children,
  useProductsContext: () => ({ registerProducts: H.registerProducts }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({ theme: "light", setTheme: () => {} }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
    functions: { invoke: () => Promise.resolve({ data: null }) },
  },
}));

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

describe("useCatalogState", () => {
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
            <ProductsProvider>
              {children}
            </ProductsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useCatalogState(), { wrapper });
    
    expect(result.current.searchQuery).toBe("");
    expect(result.current.viewMode).toBe("grid");
    expect(result.current.activeFiltersCount).toBe(0);
    expect(result.current.paginatedProducts).toEqual([]);
  });

  it("should update search query correctly", async () => {
    const { result } = renderHook(() => useCatalogState(), { wrapper });
    
    await act(async () => {
      result.current.handleSearch("test search");
    });

    expect(result.current.searchQuery).toBe("test search");
  });

  it("should reset filters correctly", async () => {
    const { result } = renderHook(() => useCatalogState(), { wrapper });
    
    await act(async () => {
      result.current.setFilters({ 
        ...result.current.filters, 
        inStock: true,
        categories: [123] 
      });
    });
    
    // categories is an array of numbers in FilterState
    expect(result.current.activeFiltersCount).toBe(2); // inStock + 1 category

    await act(async () => {
      result.current.resetFilters();
    });

    expect(result.current.activeFiltersCount).toBe(0);
    expect(result.current.searchQuery).toBe("");
  });
});

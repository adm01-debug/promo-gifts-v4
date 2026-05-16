import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCatalogState } from "@/hooks/useCatalogState";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductsProvider } from "@/contexts/ProductsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import React from "react";

// Mock all internal hooks used by useCatalogState to avoid side effects and hangs
vi.mock("@/hooks/useProductsLightweight", () => ({
  useProductsCatalog: vi.fn(() => ({
    data: { pages: [{ products: [], totalEstimate: 0 }] },
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  })),
}));

vi.mock("@/hooks/useSearch", () => ({
  useSearch: vi.fn(() => ({
    suggestions: [],
    quickSuggestions: [],
    history: [],
    addToHistory: vi.fn(),
    clearHistory: vi.fn(),
  })),
}));

vi.mock("@/hooks/useProductsByMaterial", () => ({
  useProductsByMaterial: vi.fn(() => ({
    productIds: [],
    hasFilter: false,
    isLoading: false,
  })),
}));

vi.mock("@/hooks/useProductsByCategory", () => ({
  useProductsByCategory: vi.fn(() => ({
    productIds: [],
    hasFilter: false,
    isLoading: false,
  })),
}));

vi.mock("@/hooks/useExternalCategoriesQuery", () => ({
  useExternalCategoriesQuery: vi.fn(() => ({ data: [] })),
}));

vi.mock("@/hooks/useCatalogRealStats", () => ({
  useCatalogRealStats: vi.fn(() => ({ data: null })),
}));

vi.mock("@/hooks/usePromoSalesRanking", () => ({
  usePromoSalesRanking: vi.fn(() => ({ data: new Map() })),
}));

vi.mock("@/hooks/useSupplierSalesRanking", () => ({
  useSupplierSalesRanking: vi.fn(() => ({ data: new Map() })),
}));

vi.mock("@/hooks/useColorEnrichment", () => ({
  useColorEnrichment: vi.fn(() => ({ data: new Map() })),
}));

vi.mock("@/hooks/useProductFuzzySearch", () => ({
  useProductFuzzySearch: vi.fn(() => ({ results: [], hasSearch: false })),
}));

vi.mock("@/hooks/useCatalogFiltering", () => ({
  useCatalogFiltering: vi.fn((args) => args.realProducts || []),
}));

vi.mock("@/hooks/useFavoriteQuickAdd", () => ({
  useFavoriteQuickAdd: vi.fn(() => ({
    handleFavoriteClick: vi.fn(),
    defaultList: null,
    addToList: vi.fn(),
  })),
}));

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
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

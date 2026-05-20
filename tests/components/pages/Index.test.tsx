/**
 * Render tests for Index page (667 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock("@/hooks/products/useProducts", () => ({
  useProducts: vi.fn().mockReturnValue({
    products: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/contexts/ProductsContext", () => ({
  useProductsContext: vi.fn().mockReturnValue({ products: [], loading: false }),
}));

vi.mock("@/stores/useFavoritesStore", () => ({
  useFavoritesStore: vi.fn().mockReturnValue({
    favorites: [], isFavorite: vi.fn().mockReturnValue(false), toggleFavorite: vi.fn(), favoriteCount: 0,
  }),
}));

vi.mock("@/stores/useComparisonStore", () => ({
  useComparisonStore: vi.fn().mockReturnValue({
    compareIds: [], addToCompare: vi.fn(), removeFromCompare: vi.fn(), isInCompare: vi.fn().mockReturnValue(false),
    toggleCompare: vi.fn(), canAddMore: true, compareCount: 0,
  }),
}));

vi.mock("@/hooks/common/useSearch", () => ({
  useSearch: vi.fn().mockReturnValue({ results: [], loading: false, search: vi.fn() }),
}));

vi.mock("@/hooks/productssByMaterial", () => ({
  useProductsByMaterial: vi.fn().mockReturnValue({ products: [], loading: false }),
}));

vi.mock("@/hooks/productsFuzzySearch", () => ({
  useProductFuzzySearch: vi.fn().mockReturnValue({ search: vi.fn(), results: [] }),
}));

vi.mock("@/components/filters/FilterPanel", () => ({
  FilterPanel: () => <div data-testid="filter-panel" />,
  defaultFilters: {
    search: "", colorGroups: [], colorVariations: [], colorNuances: [],
    colors: [], categories: [], suppliers: [], publicoAlvo: [],
    datasComemorativas: [], endomarketing: [], ramosAtividade: [],
    segmentosAtividade: [], materialGroups: [], materialTypes: [],
    materiais: [], techniques: [], tags: [],
    priceRange: [0, 9999], minStock: 0, inStock: false,
    isKit: false, featured: false, isNew: false,
    hasPersonalization: false, hasCommercialPackaging: false, sortBy: "name",
  },
}));

vi.mock("@/components/products/ProductGrid", () => ({
  ProductGrid: () => <div data-testid="product-grid" />,
}));

vi.mock("@/components/products/ProductList", () => ({
  ProductList: () => <div data-testid="product-list" />,
}));

vi.mock("@/components/products/ColumnSelector", () => ({
  getDefaultColumns: vi.fn().mockReturnValue(4),
}));

vi.mock("@/components/products/LayoutPopover", () => ({
  LayoutPopover: () => <div />,
}));

vi.mock("@/components/products/StatsPopover", () => ({
  StatsPopover: () => <div />,
}));

vi.mock("@/components/products/ProductCardSkeleton", () => ({
  ProductGridSkeleton: () => <div />,
}));

vi.mock("@/components/products/ProductListItemSkeleton", () => ({
  ProductListSkeleton: () => <div />,
}));

vi.mock("@/components/search", () => ({
  SmartSearchInput: () => <input data-testid="search-input" />,
}));

vi.mock("@/components/common/EmptyState", () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock("@/components/catalog/CatalogActiveFilters", () => ({
  CatalogActiveFilters: () => <div data-testid="catalog-active-filters" />,
}));

vi.mock("@/components/catalog/CatalogContent", () => ({
  CatalogContent: () => <div data-testid="catalog-content" />,
}));

vi.mock("@/components/compare/FloatingCompareBar", () => ({
  FloatingCompareBar: () => null,
}));

vi.mock("@/components/products/RecentlyViewedPopover", () => ({
  RecentlyViewedPopover: () => null,
}));

vi.mock("@/components/common/ContextualTooltips", () => ({
  InfoTooltip: () => null,
}));

vi.mock("@/data/mockData", () => ({
  CATEGORIES: [],
  SUPPLIERS: [],
}));

vi.mock("@/hooks/useCatalogState", () => ({
  useCatalogState: vi.fn().mockReturnValue({
    products: [],
    filteredProducts: [],
    loading: false,
    error: null,
    filters: {},
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    sortBy: "name",
    setSortBy: vi.fn(),
    searchTerm: "",
    setSearchTerm: vi.fn(),
    layout: "grid",
    setLayout: vi.fn(),
    columns: 4,
    setColumns: vi.fn(),
    totalProducts: 0,
    favoriteCount: 0,
    isFavorite: vi.fn().mockReturnValue(false),
    toggleFavorite: vi.fn(),
    isInCompare: vi.fn().mockReturnValue(false),
    toggleCompare: vi.fn().mockReturnValue({ added: false, isFull: false }),
    canAddMore: true,
    compareCount: 0,
    currentPage: 1,
    setCurrentPage: vi.fn(),
    totalPages: 1,
    paginatedProducts: [],
    activeFilterCount: 0,
    hasActiveFilters: false,
    stats: { total: 0, filtered: 0, categories: 0, suppliers: 0 },
  }),
}));

describe("Index Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    const { default: Index } = await import("@/pages/Index");
    renderWithProviders(<Index />);
    expect(screen.getByTestId("main-layout")).toBeInTheDocument();
  });
});

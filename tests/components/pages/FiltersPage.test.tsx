/**
 * Render tests for FiltersPage (975 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock("@/hooks/productss", () => ({
  useProducts: vi.fn().mockReturnValue({
    products: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
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
    hasPersonalization: false, hasCommercialPackaging: false, gender: [], sizes: [], sortBy: "name",
  },
}));

vi.mock("@/components/filters/PresetsBar", () => ({
  PresetsBar: () => <div data-testid="presets-bar" />,
}));

vi.mock("@/components/products/VirtualizedProductGrid", () => ({
  VirtualizedProductGrid: () => <div data-testid="product-grid" />,
}));

vi.mock("@/components/products/ProductList", () => ({
  ProductList: () => <div data-testid="product-list" />,
}));

vi.mock("@/components/products/ColumnSelector", () => ({
  ColumnSelector: () => <div />,
  getDefaultColumns: vi.fn().mockReturnValue(4),
}));

vi.mock("@/components/search/VoiceSearchOverlay", () => ({
  VoiceSearchOverlay: () => null,
}));

vi.mock("@/components/products/LayoutPopover", () => ({
  LayoutPopover: () => <div />,
}));

vi.mock("@/components/search", () => ({
  SmartSearchInput: () => <input data-testid="search-input" />,
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

vi.mock("@elevenlabs/react", () => ({
  useElevenLabsConversation: vi.fn().mockReturnValue({ status: "idle", start: vi.fn(), stop: vi.fn() }),
}));

vi.mock("@/hooks/useVoiceAgent", () => ({
  useVoiceAgent: vi.fn().mockReturnValue({
    phase: "idle", partialTranscript: "", finalTranscript: "", agentResponse: "",
    error: null, startListening: vi.fn(), stopListening: vi.fn(), stopSpeaking: vi.fn(), reset: vi.fn(),
  }),
}));

vi.mock("@/utils/color-image-resolver", () => ({
  resolveColorImage: vi.fn().mockReturnValue(null),
}));

describe("FiltersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    const { default: FiltersPage } = await import("@/pages/FiltersPage");
    renderWithProviders(<FiltersPage />);
    expect(screen.getByTestId("main-layout")).toBeInTheDocument();
  }, 15000);
});

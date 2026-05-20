/**
 * Render tests for FilterPanel (1203 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../render-helpers";
import React from "react";

vi.mock("@/hooks/products/useCategoryIcons", () => ({
  useCategoryIcons: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  getCategoryIcon: vi.fn().mockReturnValue("Package"),
}));

vi.mock("@/hooks/products/useMaterialFilter", () => ({
  useMaterialFilter: vi.fn().mockReturnValue({
    materialGroups: [],
    materialTypes: [],
    materials: [],
    allMaterials: [],
    loading: false,
    selectedGroups: [],
    selectedTypes: [],
    selectedMaterials: [],
    setSelectedGroups: vi.fn(),
    setSelectedTypes: vi.fn(),
    setSelectedMaterials: vi.fn(),
    materialFilterState: {
      selectedGroups: [],
      selectedTypes: [],
      selectedMaterials: [],
      setSelectedGroups: vi.fn(),
      setSelectedTypes: vi.fn(),
      setSelectedMaterials: vi.fn(),
    },
  }),
}));

vi.mock("@/hooks/products/useSuppliers", () => ({
  useSuppliers: vi.fn().mockReturnValue({ suppliers: [], loading: false }),
}));

vi.mock("@/hooks/crm/useRamoAtividadeFilter", () => ({
  useRamoAtividadeFilter: vi.fn().mockReturnValue({
    ramos: [], segmentos: [], loading: false,
    ramoFilterState: { selectedRamos: [], selectedSegmentos: [], setSelectedRamos: vi.fn(), setSelectedSegmentos: vi.fn() },
  }),
}));

vi.mock("@/hooks/products/useAdvancedFilters", () => ({
  useAdvancedFilters: vi.fn().mockReturnValue({
    filters: {}, setFilter: vi.fn(), resetFilters: vi.fn(),
  }),
  SORT_OPTIONS: [{ value: "name", label: "Nome" }],
}));

vi.mock("@/data/mockData", () => ({
  FAIXAS_PRECO: [{ label: "Até R$10", min: 0, max: 10 }],
}));

vi.mock("@/components/filters/DebouncedPriceInput", () => ({
  DebouncedPriceInput: (props: any) => <input data-testid="price-input" />,
}));

vi.mock("@/components/filters/ColorGroupFilter", () => ({
  ColorFilterSelection: () => <div data-testid="color-filter" />,
}));

vi.mock("@/components/filters/InlineColorGroupFilter", () => ({
  InlineColorGroupFilter: () => <div data-testid="inline-color-filter" />,
}));

vi.mock("@/components/filters/ExternalCategoryFilter", () => ({
  ExternalCategoryFilter: () => <div data-testid="external-category-filter" />,
}));

vi.mock("@/components/filters/CommemorativeDateFilter", () => ({
  CommemorativeDateFilter: () => <div data-testid="commemorative-filter" />,
}));

vi.mock("@/components/materials/MaterialBadge", () => ({
  MaterialBadge: () => <span data-testid="material-badge" />,
}));

vi.mock("@/components/ramo-atividade/RamoAtividadeBadge", () => ({
  RamoAtividadeBadge: () => <span data-testid="ramo-badge" />,
}));

vi.mock("@/components/ramo-atividade/RamoAtividadeGroupAccordion", () => ({
  RamoAtividadeGroupAccordion: () => <div data-testid="ramo-accordion" />,
}));

vi.mock("@/components/products/ColumnSelector", () => ({
  ColumnSelector: () => <div data-testid="column-selector" />,
  getDefaultColumns: vi.fn().mockReturnValue(4),
}));

describe("FilterPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports defaultFilters with correct shape", async () => {
    const { defaultFilters } = await import("@/components/filters/FilterPanel");
    expect(defaultFilters).toBeDefined();
    expect(defaultFilters.search).toBe("");
    expect(defaultFilters.sortBy).toBe("name");
    expect(defaultFilters.priceRange).toEqual([0, 9999]);
    expect(Array.isArray(defaultFilters.categories)).toBe(true);
    expect(Array.isArray(defaultFilters.colors)).toBe(true);
  });

  it("defaultFilters has all required boolean fields as false", async () => {
    const { defaultFilters } = await import("@/components/filters/FilterPanel");
    expect(defaultFilters.inStock).toBe(false);
    expect(defaultFilters.isKit).toBe(false);
    expect(defaultFilters.featured).toBe(false);
    expect(defaultFilters.isNew).toBe(false);
    expect(defaultFilters.hasPersonalization).toBe(false);
    expect(defaultFilters.hasCommercialPackaging).toBe(false);
  });
});

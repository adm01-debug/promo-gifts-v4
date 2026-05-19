/**
 * Smoke tests para hooks de catálogo complexos (deps de muitos contextos).
 */
import "../components/render-helpers";
import { vi } from "vitest";

vi.mock("@/contexts/ProductsContext", () => ({
  useProductsContext: () => ({ products: [], isLoading: false, refetch: vi.fn() }),
  ProductsProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ currentOrg: null, organizations: [], isLoading: false }),
}));

import { useCatalogFiltering } from "@/hooks/products";
import { useComparisonSync } from "@/hooks/useComparisonSync";
import { smokeHook } from "./_helpers/smoke-template";

// Proxy que retorna [] para qualquer campo de array acessado, evitando crash
// no useMemo do hook (que lê dezenas de campos do FilterState).
const filtersProxy = new Proxy({}, {
  get: (_t, prop) => {
    if (prop === "stock") return "all";
    if (prop === "search") return "";
    if (prop === "priceRange" || prop === "minQuantityRange") return [0, 1000];
    if (typeof prop === "string" && (prop.endsWith("Only") || prop === "hasImage")) return false;
    return [];
  },
}) as never;

smokeHook("useCatalogFiltering (vazio)", () =>
  useCatalogFiltering({
    realProducts: [],
    filters: filtersProxy,
    sortBy: "name",
    hasFuzzySearch: false,
    fuzzySearchResults: [],
    hasMaterialFilter: false,
    materialFilteredProductIds: new Set(),
    isLoadingMaterialFilter: false,
    hasCategoryFilter: false,
    categoryFilteredProductIds: new Set(),
    isLoadingCategoryFilter: false,
  }),
);

smokeHook("useComparisonSync", () => useComparisonSync());

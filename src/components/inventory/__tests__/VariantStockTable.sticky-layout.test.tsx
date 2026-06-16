import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VariantStockTable } from "../VariantStockTable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type ProductStockSummary, type VariantStock } from "@/types/stock";

vi.mock("@/utils/color-group-hex", () => ({ COLOR_GROUP_HEX: {}, resolveHighlightHex: () => "#000" }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

const makeVariant = (productId: string, index: number): VariantStock => ({
  id: `${productId}-v${index}`,
  productId,
  variantId: `${productId}-v${index}`,
  variantSku: `${productId}-SKU-${index}`,
  colorName: `Cor ${index}`,
  colorHex: "#000000",
  currentStock: 100 + index,
  minStock: 10,
  reservedStock: 0,
  inTransitStock: 0,
  availableStock: 100 + index,
  status: "in_stock",
  updatedAt: "2026-01-01",
});

const makeProduct = (index: number): ProductStockSummary => {
  const productId = `p${index}`;
  const variant = makeVariant(productId, index);
  return {
    productId,
    productName: `Produto ${index}`,
    productSku: `SKU-${index}`,
    categoryName: "Categoria",
    supplierName: "Fornecedor",
    overallStatus: "in_stock",
    variantsInStock: 1,
    variantsLowStock: 0,
    variantsCritical: 0,
    variantsOutOfStock: 0,
    availableColors: [
      {
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        count: 1,
        totalStock: variant.currentStock,
        availableStock: variant.availableStock,
        status: variant.status,
      },
    ],
    totalVariants: 1,
    totalCurrentStock: variant.currentStock,
    totalMinStock: variant.minStock,
    totalReservedStock: 0,
    totalInTransitStock: 0,
    totalAvailableStock: variant.availableStock,
    variants: [variant],
  };
};

describe("VariantStockTable — contrato sticky", () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    class ResizeObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRectMock() {
      if (this.getAttribute("data-testid") === "variant-stock-toolbar") {
        return { x: 0, y: 96, width: 360, height: 72, top: 96, right: 360, bottom: 168, left: 0, toJSON: () => ({}) };
      }
      return originalGetBoundingClientRect.call(this);
    };
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("ancora toolbar abaixo do header/breadcrumb e thead abaixo da altura real da toolbar", async () => {
    render(
      <TooltipProvider>
        <VariantStockTable products={Array.from({ length: 60 }, (_, index) => makeProduct(index + 1))} />
      </TooltipProvider>,
    );

    const table = screen.getByTestId("variant-stock-table");
    const toolbar = screen.getByTestId("variant-stock-toolbar");
    const thead = screen.getByTestId("variant-stock-thead");

    expect(toolbar.className).toContain("top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))]");
    expect(thead.className).toContain(
      "top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px)+var(--variant-stock-toolbar-h,44px))]",
    );

    await waitFor(() => {
      expect(table).toHaveStyle({ "--variant-stock-toolbar-h": "72px" });
    });
  });
});
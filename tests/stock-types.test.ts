import { describe, it, expect } from "vitest";
import {
  calculateStockStatus,
  calculateDaysUntilStockout,
  calculateAvailableStock,
  aggregateVariantsToProduct,
  defaultStockFilters,
} from "@/types/stock";
import type { VariantStock } from "@/types/stock";

describe("calculateStockStatus", () => {
  it("returns out_of_stock when current is 0", () => {
    expect(calculateStockStatus(0, 50)).toBe("out_of_stock");
  });

  it("returns incoming when current is 0 but in transit > 0", () => {
    expect(calculateStockStatus(0, 50, undefined, 10)).toBe("incoming");
  });

  // NOTA: a régua baseada em `min` (low_stock/critical) foi descontinuada
  // — calculateStockStatus retorna `in_stock` para qualquer current > 0.
  it("does NOT derive critical from min (deprecated)", () => {
    expect(calculateStockStatus(10, 50)).toBe("in_stock");
    expect(calculateStockStatus(12, 50)).toBe("in_stock");
  });

  it("does NOT derive low_stock from min (deprecated)", () => {
    expect(calculateStockStatus(40, 50)).toBe("in_stock");
    expect(calculateStockStatus(50, 50)).toBe("in_stock");
  });

  it("returns in_stock for normal levels", () => {
    expect(calculateStockStatus(100, 50)).toBe("in_stock");
  });

  it("returns overstocked when current > max * 1.5", () => {
    expect(calculateStockStatus(200, 50, 100)).toBe("overstocked");
  });

  it("returns in_stock when current is high but no max", () => {
    expect(calculateStockStatus(1000, 50)).toBe("in_stock");
  });
});

describe("calculateDaysUntilStockout", () => {
  it("returns correct days", () => {
    expect(calculateDaysUntilStockout(100, 5)).toBe(20);
  });

  it("returns undefined for zero sales", () => {
    expect(calculateDaysUntilStockout(100, 0)).toBeUndefined();
  });

  it("returns undefined for zero stock", () => {
    expect(calculateDaysUntilStockout(0, 5)).toBeUndefined();
  });

  it("uses default daily sales of 2", () => {
    expect(calculateDaysUntilStockout(10)).toBe(5);
  });
});

describe("calculateAvailableStock", () => {
  it("subtracts reserved from current", () => {
    expect(calculateAvailableStock(100, 30)).toBe(70);
  });

  it("returns 0 when reserved exceeds current", () => {
    expect(calculateAvailableStock(10, 30)).toBe(0);
  });

  it("returns current when no reserved", () => {
    expect(calculateAvailableStock(100)).toBe(100);
  });
});

describe("aggregateVariantsToProduct", () => {
  const makeVariant = (overrides: Partial<VariantStock>): VariantStock => ({
    id: "v1",
    productId: "p1",
    variantId: "var1",
    variantSku: "SKU-001",
    colorName: "Azul",
    currentStock: 50,
    minStock: 20,
    reservedStock: 5,
    inTransitStock: 0,
    availableStock: 45,
    status: "in_stock",
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it("aggregates totals correctly", () => {
    const variants = [
      makeVariant({ id: "v1", currentStock: 50, reservedStock: 5, availableStock: 45 }),
      makeVariant({ id: "v2", currentStock: 30, reservedStock: 10, availableStock: 20, colorName: "Vermelho" }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.totalCurrentStock).toBe(80);
    expect(result.totalReservedStock).toBe(15);
    expect(result.totalAvailableStock).toBe(65);
    expect(result.totalVariants).toBe(2);
  });

  it("counts variants by status", () => {
    const variants = [
      makeVariant({ id: "v1", status: "in_stock" }),
      makeVariant({ id: "v2", status: "low_stock" }),
      makeVariant({ id: "v3", status: "out_of_stock" }),
      makeVariant({ id: "v4", status: "critical" }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.variantsInStock).toBe(1);
    expect(result.variantsLowStock).toBe(1);
    expect(result.variantsOutOfStock).toBe(1);
    expect(result.variantsCritical).toBe(1);
  });

  it("groups colors correctly", () => {
    const variants = [
      makeVariant({ id: "v1", colorName: "Azul" }),
      makeVariant({ id: "v2", colorName: "Azul" }),
      makeVariant({ id: "v3", colorName: "Vermelho" }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.availableColors).toHaveLength(2);
    expect(result.availableColors.find(c => c.colorName === "Azul")?.variants).toHaveLength(2);
  });

  it("handles empty variants array", () => {
    const result = aggregateVariantsToProduct([]);
    expect(result.totalCurrentStock).toBe(0);
    expect(result.totalVariants).toBe(0);
    expect(result.overallStatus).toBe("in_stock");
  });

  it("sets overall status to out_of_stock when all are out", () => {
    const variants = [
      makeVariant({ id: "v1", status: "out_of_stock" }),
      makeVariant({ id: "v2", status: "out_of_stock" }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.overallStatus).toBe("out_of_stock");
  });

  it("sets overall status to critical when some are out", () => {
    const variants = [
      makeVariant({ id: "v1", status: "in_stock" }),
      makeVariant({ id: "v2", status: "out_of_stock" }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.overallStatus).toBe("critical");
  });

  it("sets overall status to incoming when out + in transit", () => {
    const variants = [
      makeVariant({ id: "v1", status: "out_of_stock", currentStock: 0, inTransitStock: 50 }),
      makeVariant({ id: "v2", status: "incoming", currentStock: 0, inTransitStock: 20 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.overallStatus).toBe("incoming");
  });
});

describe("defaultStockFilters", () => {
  it("has correct defaults", () => {
    expect(defaultStockFilters.status).toBe("all");
    expect(defaultStockFilters.search).toBe("");
    expect(defaultStockFilters.sortBy).toBe("stock_quantity");
    expect(defaultStockFilters.sortDirection).toBe("asc");
    expect(defaultStockFilters.showOnlyWithAlerts).toBe(false);
  });
});

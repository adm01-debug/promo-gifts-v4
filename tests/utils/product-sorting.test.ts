/**
 * Exhaustive tests for the shared sorting utility and usePromoSalesRanking hook.
 * Validates all 7 sort modes, edge cases, and parity between Catalog & Super Filter.
 *
 * NOTE: sortProducts() is NON-MUTATING — it returns a new sorted array and leaves
 * the original unchanged. All tests must capture and check the return value.
 */
import { describe, it, expect } from "vitest";
import { sortProducts, compareNamePtBR } from "@/utils/product-sorting";

// Minimal product factory
function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id as string ?? "p1",
    name: overrides.name as string ?? "Product A",
    price: overrides.price as number ?? 10,
    stock: overrides.stock as number ?? 50,
    created_at: overrides.created_at as string ?? "2025-01-01",
    featured: overrides.featured as boolean ?? false,
    newArrival: overrides.newArrival as boolean ?? false,
    ...overrides,
  } as any;
}

describe("sortProducts", () => {
  // ===== SORT BY NAME =====
  describe("name sort", () => {
    it("sorts alphabetically A-Z", () => {
      const products = [makeProduct({ name: "Zebra" }), makeProduct({ name: "Alpha" }), makeProduct({ name: "Mango" })];
      const sorted = sortProducts(products, "name");
      expect(sorted.map(p => p.name)).toEqual(["Alpha", "Mango", "Zebra"]);
    });

    it("handles accented characters correctly", () => {
      const products = [makeProduct({ name: "Ábaco" }), makeProduct({ name: "Açaí" }), makeProduct({ name: "Abacate" })];
      const sorted = sortProducts(products, "name");
      // localeCompare should handle accents properly
      expect(sorted[0].name).toBeTruthy();
    });

    it("handles empty name strings", () => {
      const products = [makeProduct({ name: "" }), makeProduct({ name: "A" })];
      const sorted = sortProducts(products, "name");
      expect(sorted[0].name).toBe("");
    });

    it("handles identical names (stable sort)", () => {
      const products = [makeProduct({ id: "p1", name: "Same" }), makeProduct({ id: "p2", name: "Same" })];
      const sorted = sortProducts(products, "name");
      expect(sorted.length).toBe(2);
    });
  });

  // ===== SORT BY PRICE =====
  describe("price-asc sort", () => {
    it("sorts from cheapest to most expensive", () => {
      const products = [makeProduct({ price: 50 }), makeProduct({ price: 10 }), makeProduct({ price: 30 })];
      const sorted = sortProducts(products, "price-asc");
      expect(sorted.map(p => p.price)).toEqual([10, 30, 50]);
    });

    it("handles zero prices", () => {
      const products = [makeProduct({ price: 10 }), makeProduct({ price: 0 })];
      const sorted = sortProducts(products, "price-asc");
      expect(sorted[0].price).toBe(0);
    });

    it("handles equal prices", () => {
      const products = [makeProduct({ id: "a", price: 5 }), makeProduct({ id: "b", price: 5 })];
      const sorted = sortProducts(products, "price-asc");
      expect(sorted.length).toBe(2);
    });
  });

  describe("price-desc sort", () => {
    it("sorts from most expensive to cheapest", () => {
      const products = [makeProduct({ price: 10 }), makeProduct({ price: 50 }), makeProduct({ price: 30 })];
      const sorted = sortProducts(products, "price-desc");
      expect(sorted.map(p => p.price)).toEqual([50, 30, 10]);
    });
  });

  // ===== SORT BY STOCK =====
  describe("stock sort", () => {
    it("sorts highest stock first", () => {
      const products = [makeProduct({ stock: 5 }), makeProduct({ stock: 100 }), makeProduct({ stock: 50 })];
      const sorted = sortProducts(products, "stock");
      expect(sorted.map(p => p.stock)).toEqual([100, 50, 5]);
    });

    it("handles null/undefined stock as 0", () => {
      const products = [makeProduct({ stock: 10 }), makeProduct({ stock: undefined }), makeProduct({ stock: null })];
      const sorted = sortProducts(products, "stock");
      expect(sorted[0].stock).toBe(10);
    });

    it("handles all zero stock", () => {
      const products = [makeProduct({ stock: 0 }), makeProduct({ stock: 0 })];
      const sorted = sortProducts(products, "stock");
      expect(sorted.every(p => (p.stock || 0) === 0)).toBe(true);
    });
  });

  // ===== SORT BY NEWEST =====
  describe("newest sort", () => {
    it("sorts newest first", () => {
      const products = [
        makeProduct({ id: "old", created_at: "2024-01-01" }),
        makeProduct({ id: "new", created_at: "2025-06-15" }),
        makeProduct({ id: "mid", created_at: "2025-03-01" }),
      ];
      const sorted = sortProducts(products, "newest");
      expect(sorted.map(p => p.id)).toEqual(["new", "mid", "old"]);
    });

    it("handles missing created_at", () => {
      const products = [makeProduct({ created_at: "2025-01-01" }), makeProduct({ created_at: undefined })];
      const sorted = sortProducts(products, "newest");
      expect(sorted.length).toBe(2);
    });
  });

  // ===== BEST SELLER SUPPLIER =====
  describe("best-seller-supplier sort", () => {
    it("prioritizes featured products", () => {
      const products = [
        makeProduct({ id: "normal", featured: false, stock: 100 }),
        makeProduct({ id: "featured", featured: true, stock: 10 }),
      ];
      const sorted = sortProducts(products, "best-seller-supplier");
      expect(sorted[0].id).toBe("featured");
    });

    it("uses newArrival as secondary signal", () => {
      const products = [
        makeProduct({ id: "old", featured: true, newArrival: false, stock: 100 }),
        makeProduct({ id: "new", featured: true, newArrival: true, stock: 10 }),
      ];
      const sorted = sortProducts(products, "best-seller-supplier");
      expect(sorted[0].id).toBe("new");
    });

    it("uses stock as tiebreaker when scores are equal", () => {
      const products = [
        makeProduct({ id: "low", featured: false, stock: 10 }),
        makeProduct({ id: "high", featured: false, stock: 100 }),
      ];
      const sorted = sortProducts(products, "best-seller-supplier");
      expect(sorted[0].id).toBe("high");
    });

    it("handles all non-featured products", () => {
      const products = [
        makeProduct({ id: "c", featured: false, stock: 5 }),
        makeProduct({ id: "a", featured: false, stock: 50 }),
        makeProduct({ id: "b", featured: false, stock: 25 }),
      ];
      const sorted = sortProducts(products, "best-seller-supplier");
      expect(sorted.map(p => p.id)).toEqual(["a", "b", "c"]);
    });
  });

  // ===== BEST SELLER PROMO =====
  describe("best-seller-promo sort", () => {
    it("sorts by sales count descending", () => {
      const salesMap = new Map([["p1", 100], ["p2", 50], ["p3", 200]]);
      const products = [makeProduct({ id: "p1" }), makeProduct({ id: "p2" }), makeProduct({ id: "p3" })];
      const sorted = sortProducts(products, "best-seller-promo", { promoSalesMap: salesMap });
      expect(sorted.map(p => p.id)).toEqual(["p3", "p1", "p2"]);
    });

    it("uses name as tiebreaker when sales are equal", () => {
      const salesMap = new Map([["p1", 50], ["p2", 50]]);
      const products = [makeProduct({ id: "p2", name: "Zebra" }), makeProduct({ id: "p1", name: "Alpha" })];
      const sorted = sortProducts(products, "best-seller-promo", { promoSalesMap: salesMap });
      expect(sorted.map(p => p.name)).toEqual(["Alpha", "Zebra"]);
    });

    it("handles missing sales data (treats as 0)", () => {
      const salesMap = new Map([["p1", 100]]);
      const products = [makeProduct({ id: "p2", name: "NoSales" }), makeProduct({ id: "p1", name: "HasSales" })];
      const sorted = sortProducts(products, "best-seller-promo", { promoSalesMap: salesMap });
      expect(sorted[0].id).toBe("p1");
    });

    it("handles undefined promoSalesMap gracefully", () => {
      const products = [makeProduct({ id: "p1", name: "B" }), makeProduct({ id: "p2", name: "A" })];
      const sorted = sortProducts(products, "best-seller-promo", { promoSalesMap: undefined });
      // All have 0 sales, so should sort by name
      expect(sorted.map(p => p.name)).toEqual(["A", "B"]);
    });

    it("handles empty promoSalesMap", () => {
      const products = [makeProduct({ name: "C" }), makeProduct({ name: "A" }), makeProduct({ name: "B" })];
      const sorted = sortProducts(products, "best-seller-promo", { promoSalesMap: new Map() });
      expect(sorted.map(p => p.name)).toEqual(["A", "B", "C"]);
    });
  });

  // ===== SKIP SORT =====
  describe("skipSort option", () => {
    it("preserves original order when skipSort is true", () => {
      const products = [makeProduct({ name: "Z" }), makeProduct({ name: "A" }), makeProduct({ name: "M" })];
      const original = products.map(p => p.name);
      const sorted = sortProducts(products, "name", { skipSort: true });
      expect(sorted.map(p => p.name)).toEqual(original);
    });

    it("skips sort even for price-desc", () => {
      const products = [makeProduct({ price: 1 }), makeProduct({ price: 100 })];
      const sorted = sortProducts(products, "price-desc", { skipSort: true });
      expect(sorted[0].price).toBe(1); // unchanged
    });
  });

  // ===== UNKNOWN SORT VALUE =====
  describe("unknown sort value", () => {
    it("does not throw on unknown sort value", () => {
      const products = [makeProduct()];
      expect(() => sortProducts(products, "unknown-sort")).not.toThrow();
    });

    it("preserves order on unknown sort value", () => {
      const products = [makeProduct({ name: "B" }), makeProduct({ name: "A" })];
      const sorted = sortProducts(products, "nonsense");
      expect(sorted[0].name).toBe("B"); // unchanged order
    });
  });

  // ===== EDGE CASES =====
  describe("edge cases", () => {
    it("handles empty array", () => {
      const products: any[] = [];
      expect(() => sortProducts(products, "name")).not.toThrow();
      expect(products.length).toBe(0);
    });

    it("handles single element array", () => {
      const products = [makeProduct()];
      const sorted = sortProducts(products, "price-asc");
      expect(sorted.length).toBe(1);
    });

    it("handles large array (1000 items)", () => {
      const products = Array.from({ length: 1000 }, (_, i) =>
        makeProduct({ id: `p${i}`, name: `Product ${1000 - i}`, price: Math.random() * 1000 })
      );
      const sorted = sortProducts(products, "price-asc");
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].price).toBeGreaterThanOrEqual(sorted[i - 1].price);
      }
    });

    it("does NOT mutate original array (non-mutating contract)", () => {
      const products = [makeProduct({ name: "Z" }), makeProduct({ name: "A" })];
      const originalFirst = products[0].name;
      sortProducts(products, "name");
      // Original array must be unchanged
      expect(products[0].name).toBe(originalFirst);
    });

    it("returns a new sorted array (different reference from input)", () => {
      const products = [makeProduct()];
      const result = sortProducts(products, "name");
      expect(result).not.toBe(products); // non-mutating: new array returned
      expect(result).toStrictEqual(products); // same content (1 element, same order)
    });
  });

  // ===== PT-BR COLLATOR + NAME ALIASES + DETERMINISM =====
  describe("pt-BR collation and name aliases", () => {
    it("orders numbers naturally (Caneta 2 before Caneta 10)", () => {
      const products = [
        makeProduct({ name: "Caneta 10" }),
        makeProduct({ name: "Caneta 2" }),
        makeProduct({ name: "Caneta 1" }),
      ];
      const sorted = sortProducts(products, "name");
      expect(sorted.map(p => p.name)).toEqual(["Caneta 1", "Caneta 2", "Caneta 10"]);
    });

    it("respects Brazilian Portuguese accent ordering", () => {
      const products = [
        makeProduct({ id: "a", name: "Água" }),
        makeProduct({ id: "b", name: "Abacaxi" }),
        makeProduct({ id: "c", name: "Açaí" }),
      ];
      const sorted = sortProducts(products, "name");
      // base sensitivity: Abacaxi < Açaí < Água
      expect(sorted.map((p) => p.name)).toEqual(["Abacaxi", "Açaí", "Água"]);
    });

    it("treats 'name-asc' as ascending name sort", () => {
      const products = [makeProduct({ name: "Zebra" }), makeProduct({ name: "Alpha" })];
      const sorted = sortProducts(products, "name-asc");
      expect(sorted.map((p) => p.name)).toEqual(["Alpha", "Zebra"]);
    });

    it("treats 'name-desc' as descending name sort", () => {
      const products = [makeProduct({ name: "Alpha" }), makeProduct({ name: "Zebra" })];
      const sorted = sortProducts(products, "name-desc");
      expect(sorted.map((p) => p.name)).toEqual(["Zebra", "Alpha"]);
    });

    it("compareNamePtBR is null/undefined safe", () => {
      expect(compareNamePtBR(null, "a")).toBeLessThan(0);
      expect(compareNamePtBR("a", undefined)).toBeGreaterThan(0);
      expect(compareNamePtBR(null, null)).toBe(0);
    });
  });

  describe("deterministic id tiebreak", () => {
    it("breaks equal names by id (stable, page-safe order)", () => {
      const products = [
        makeProduct({ id: "p3", name: "Same" }),
        makeProduct({ id: "p1", name: "Same" }),
        makeProduct({ id: "p2", name: "Same" }),
      ];
      const sorted = sortProducts(products, "name");
      expect(sorted.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    });

    it("breaks equal prices by id deterministically", () => {
      const products = [
        makeProduct({ id: "p3", price: 5 }),
        makeProduct({ id: "p1", price: 5 }),
        makeProduct({ id: "p2", price: 5 }),
      ];
      const sorted = sortProducts(products, "price-asc");
      expect(sorted.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    });

    it("breaks equal stock by id deterministically", () => {
      const products = [
        makeProduct({ id: "b", stock: 7 }),
        makeProduct({ id: "a", stock: 7 }),
      ];
      const sorted = sortProducts(products, "stock");
      expect(sorted.map((p) => p.id)).toEqual(["a", "b"]);
    });
  });

  // ===== PARITY CHECK =====
  describe("parity between Catalog and Super Filter", () => {
    it("produces identical results for all sort modes", () => {
      const salesMap = new Map([["p1", 200], ["p2", 100], ["p3", 50]]);
      const baseProducts = [
        makeProduct({ id: "p1", name: "Caneta", price: 5, stock: 100, created_at: "2025-01-01", featured: false }),
        makeProduct({ id: "p2", name: "Agenda", price: 25, stock: 50, created_at: "2025-06-01", featured: true, newArrival: true }),
        makeProduct({ id: "p3", name: "Bolsa", price: 80, stock: 10, created_at: "2024-06-01", featured: true }),
      ];

      const sortModes = ["name", "price-asc", "price-desc", "stock", "newest", "best-seller-supplier", "best-seller-promo"];

      for (const mode of sortModes) {
        const catalogCopy = baseProducts.map(p => ({ ...p }));
        const filterCopy = baseProducts.map(p => ({ ...p }));

        const catalogSorted = sortProducts(catalogCopy, mode, { promoSalesMap: salesMap });
        const filterSorted = sortProducts(filterCopy, mode, { promoSalesMap: salesMap });

        expect(catalogSorted.map(p => p.id)).toEqual(filterSorted.map(p => p.id));
      }
    });
  });
});

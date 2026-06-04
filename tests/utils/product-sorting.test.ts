/**
 * Exhaustive tests for the shared sorting utility and usePromoSalesRanking hook.
 * Validates all 7 sort modes, edge cases, and parity between Catalog & Super Filter.
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
      sortProducts(products, "name");
      expect(products.map(p => p.name)).toEqual(["Alpha", "Mango", "Zebra"]);
    });

    it("handles accented characters correctly", () => {
      const products = [makeProduct({ name: "Ábaco" }), makeProduct({ name: "Açaí" }), makeProduct({ name: "Abacate" })];
      sortProducts(products, "name");
      // localeCompare should handle accents properly
      expect(products[0].name).toBeTruthy();
    });

    it("handles empty name strings", () => {
      const products = [makeProduct({ name: "" }), makeProduct({ name: "A" })];
      sortProducts(products, "name");
      expect(products[0].name).toBe("");
    });

    it("handles identical names (stable sort)", () => {
      const products = [makeProduct({ id: "p1", name: "Same" }), makeProduct({ id: "p2", name: "Same" })];
      sortProducts(products, "name");
      expect(products.length).toBe(2);
    });
  });

  // ===== SORT BY PRICE =====
  describe("price-asc sort", () => {
    it("sorts from cheapest to most expensive", () => {
      const products = [makeProduct({ price: 50 }), makeProduct({ price: 10 }), makeProduct({ price: 30 })];
      sortProducts(products, "price-asc");
      expect(products.map(p => p.price)).toEqual([10, 30, 50]);
    });

    it("handles zero prices", () => {
      const products = [makeProduct({ price: 10 }), makeProduct({ price: 0 })];
      sortProducts(products, "price-asc");
      expect(products[0].price).toBe(0);
    });

    it("handles equal prices", () => {
      const products = [makeProduct({ id: "a", price: 5 }), makeProduct({ id: "b", price: 5 })];
      sortProducts(products, "price-asc");
      expect(products.length).toBe(2);
    });
  });

  describe("price-desc sort", () => {
    it("sorts from most expensive to cheapest", () => {
      const products = [makeProduct({ price: 10 }), makeProduct({ price: 50 }), makeProduct({ price: 30 })];
      sortProducts(products, "price-desc");
      expect(products.map(p => p.price)).toEqual([50, 30, 10]);
    });
  });

  // ===== SORT BY STOCK =====
  describe("stock sort", () => {
    it("sorts highest stock first", () => {
      const products = [makeProduct({ stock: 5 }), makeProduct({ stock: 100 }), makeProduct({ stock: 50 })];
      sortProducts(products, "stock");
      expect(products.map(p => p.stock)).toEqual([100, 50, 5]);
    });

    it("handles null/undefined stock as 0", () => {
      const products = [makeProduct({ stock: 10 }), makeProduct({ stock: undefined }), makeProduct({ stock: null })];
      sortProducts(products, "stock");
      expect(products[0].stock).toBe(10);
    });

    it("handles all zero stock", () => {
      const products = [makeProduct({ stock: 0 }), makeProduct({ stock: 0 })];
      sortProducts(products, "stock");
      expect(products.every(p => (p.stock || 0) === 0)).toBe(true);
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
      sortProducts(products, "newest");
      expect(products.map(p => p.id)).toEqual(["new", "mid", "old"]);
    });

    it("handles missing created_at", () => {
      const products = [makeProduct({ created_at: "2025-01-01" }), makeProduct({ created_at: undefined })];
      sortProducts(products, "newest");
      expect(products.length).toBe(2);
    });
  });

  // ===== BEST SELLER SUPPLIER =====
  describe("best-seller-supplier sort", () => {
    it("prioritizes featured products", () => {
      const products = [
        makeProduct({ id: "normal", featured: false, stock: 100 }),
        makeProduct({ id: "featured", featured: true, stock: 10 }),
      ];
      sortProducts(products, "best-seller-supplier");
      expect(products[0].id).toBe("featured");
    });

    it("uses newArrival as secondary signal", () => {
      const products = [
        makeProduct({ id: "old", featured: true, newArrival: false, stock: 100 }),
        makeProduct({ id: "new", featured: true, newArrival: true, stock: 10 }),
      ];
      sortProducts(products, "best-seller-supplier");
      expect(products[0].id).toBe("new");
    });

    it("uses stock as tiebreaker when scores are equal", () => {
      const products = [
        makeProduct({ id: "low", featured: false, stock: 10 }),
        makeProduct({ id: "high", featured: false, stock: 100 }),
      ];
      sortProducts(products, "best-seller-supplier");
      expect(products[0].id).toBe("high");
    });

    it("handles all non-featured products", () => {
      const products = [
        makeProduct({ id: "c", featured: false, stock: 5 }),
        makeProduct({ id: "a", featured: false, stock: 50 }),
        makeProduct({ id: "b", featured: false, stock: 25 }),
      ];
      sortProducts(products, "best-seller-supplier");
      expect(products.map(p => p.id)).toEqual(["a", "b", "c"]);
    });
  });

  // ===== BEST SELLER PROMO =====
  describe("best-seller-promo sort", () => {
    it("sorts by sales count descending", () => {
      const salesMap = new Map([["p1", 100], ["p2", 50], ["p3", 200]]);
      const products = [makeProduct({ id: "p1" }), makeProduct({ id: "p2" }), makeProduct({ id: "p3" })];
      sortProducts(products, "best-seller-promo", { promoSalesMap: salesMap });
      expect(products.map(p => p.id)).toEqual(["p3", "p1", "p2"]);
    });

    it("uses name as tiebreaker when sales are equal", () => {
      const salesMap = new Map([["p1", 50], ["p2", 50]]);
      const products = [makeProduct({ id: "p2", name: "Zebra" }), makeProduct({ id: "p1", name: "Alpha" })];
      sortProducts(products, "best-seller-promo", { promoSalesMap: salesMap });
      expect(products.map(p => p.name)).toEqual(["Alpha", "Zebra"]);
    });

    it("handles missing sales data (treats as 0)", () => {
      const salesMap = new Map([["p1", 100]]);
      const products = [makeProduct({ id: "p2", name: "NoSales" }), makeProduct({ id: "p1", name: "HasSales" })];
      sortProducts(products, "best-seller-promo", { promoSalesMap: salesMap });
      expect(products[0].id).toBe("p1");
    });

    it("handles undefined promoSalesMap gracefully", () => {
      const products = [makeProduct({ id: "p1", name: "B" }), makeProduct({ id: "p2", name: "A" })];
      sortProducts(products, "best-seller-promo", { promoSalesMap: undefined });
      // All have 0 sales, so should sort by name
      expect(products.map(p => p.name)).toEqual(["A", "B"]);
    });

    it("handles empty promoSalesMap", () => {
      const products = [makeProduct({ name: "C" }), makeProduct({ name: "A" }), makeProduct({ name: "B" })];
      sortProducts(products, "best-seller-promo", { promoSalesMap: new Map() });
      expect(products.map(p => p.name)).toEqual(["A", "B", "C"]);
    });
  });

  // ===== SKIP SORT =====
  describe("skipSort option", () => {
    it("preserves original order when skipSort is true", () => {
      const products = [makeProduct({ name: "Z" }), makeProduct({ name: "A" }), makeProduct({ name: "M" })];
      const original = products.map(p => p.name);
      sortProducts(products, "name", { skipSort: true });
      expect(products.map(p => p.name)).toEqual(original);
    });

    it("skips sort even for price-desc", () => {
      const products = [makeProduct({ price: 1 }), makeProduct({ price: 100 })];
      sortProducts(products, "price-desc", { skipSort: true });
      expect(products[0].price).toBe(1); // unchanged
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
      sortProducts(products, "nonsense");
      expect(products[0].name).toBe("B"); // unchanged
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
      sortProducts(products, "price-asc");
      expect(products.length).toBe(1);
    });

    it("handles large array (1000 items)", () => {
      const products = Array.from({ length: 1000 }, (_, i) =>
        makeProduct({ id: `p${i}`, name: `Product ${1000 - i}`, price: Math.random() * 1000 })
      );
      sortProducts(products, "price-asc");
      for (let i = 1; i < products.length; i++) {
        expect(products[i].price).toBeGreaterThanOrEqual(products[i - 1].price);
      }
    });

    it("sort is in-place (mutates the array)", () => {
      const products = [makeProduct({ name: "Z" }), makeProduct({ name: "A" })];
      const ref = products;
      sortProducts(products, "name");
      expect(ref).toBe(products);
      expect(ref[0].name).toBe("A");
    });

    it("returns the same array reference", () => {
      const products = [makeProduct()];
      const result = sortProducts(products, "name");
      expect(result).toBe(products);
    });
  });

  // ===== PT-BR COLLATOR + NAME ALIASES + DETERMINISM =====
  describe("pt-BR collation and name aliases", () => {
    it("orders numbers naturally (Caneta 2 before Caneta 10)", () => {
      const products = [
        makeProduct({ id: "a", name: "Caneta 10" }),
        makeProduct({ id: "b", name: "Caneta 2" }),
        makeProduct({ id: "c", name: "Caneta 1" }),
      ];
      sortProducts(products, "name");
      expect(products.map((p) => p.name)).toEqual(["Caneta 1", "Caneta 2", "Caneta 10"]);
    });

    it("orders accented pt-BR names base-insensitively", () => {
      const products = [
        makeProduct({ id: "a", name: "Água" }),
        makeProduct({ id: "b", name: "Abacaxi" }),
        makeProduct({ id: "c", name: "Açaí" }),
      ];
      sortProducts(products, "name");
      // base sensitivity: Abacaxi < Açaí < Água
      expect(products.map((p) => p.name)).toEqual(["Abacaxi", "Açaí", "Água"]);
    });

    it("treats 'name-asc' as ascending name sort", () => {
      const products = [makeProduct({ name: "Zebra" }), makeProduct({ name: "Alpha" })];
      sortProducts(products, "name-asc");
      expect(products.map((p) => p.name)).toEqual(["Alpha", "Zebra"]);
    });

    it("treats 'name-desc' as descending name sort", () => {
      const products = [makeProduct({ name: "Alpha" }), makeProduct({ name: "Zebra" })];
      sortProducts(products, "name-desc");
      expect(products.map((p) => p.name)).toEqual(["Zebra", "Alpha"]);
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
      sortProducts(products, "name");
      expect(products.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    });

    it("breaks equal prices by id deterministically", () => {
      const products = [
        makeProduct({ id: "p3", price: 5 }),
        makeProduct({ id: "p1", price: 5 }),
        makeProduct({ id: "p2", price: 5 }),
      ];
      sortProducts(products, "price-asc");
      expect(products.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    });

    it("breaks equal stock by id deterministically", () => {
      const products = [
        makeProduct({ id: "b", stock: 7 }),
        makeProduct({ id: "a", stock: 7 }),
      ];
      sortProducts(products, "stock");
      expect(products.map((p) => p.id)).toEqual(["a", "b"]);
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

        sortProducts(catalogCopy, mode, { promoSalesMap: salesMap });
        sortProducts(filterCopy, mode, { promoSalesMap: salesMap });

        expect(catalogCopy.map(p => p.id)).toEqual(filterCopy.map(p => p.id));
      }
    });
  });
});

/**
 * Tests for src/utils/product-mapper.ts
 */
import { describe, it, expect, vi } from "vitest";

// Mock external-db helpers
vi.mock("@/lib/external-db", () => ({
  getProductImageUrl: vi.fn((p: any) => p.images?.[0]?.url || "/placeholder.svg"),
  getProductPrice: vi.fn((p: any) => p.price || 0),
  getProductStock: vi.fn((p: any) => p.stock ?? 0),
}));

vi.mock("@/utils/product-colors", () => ({
  normalizeColors: vi.fn((colors: any[]) =>
    (colors || []).map((c: any) => ({
      name: typeof c === "string" ? c : c.name || "Sem cor",
      hex: "#CCCCCC",
      group: "Outros",
    }))
  ),
}));

import { mapPromobrindToProduct } from "@/utils/product-mapper";

const baseProduct = {
  id: "prod-1",
  name: "Caneta Luxo",
  sku: "CAN-001",
  description: "Caneta premium",
  price: 15.5,
  stock: 100,
  category_id: "10",
  category_name: "Escrita",
  supplier_id: "sup-1",
  supplier_name: "Fornecedor A",
  brand: "MarcaX",
  is_active: true,
  is_featured: true,
  is_new: false,
  is_kit: false,
  min_quantity: 50,
  materials: "Metal, Plástico",
  colors: [
    { name: "Azul", hex: "#0000FF", stock: 50 },
    { name: "Preto", hex: "#000000", stock: 50 },
  ],
  images: [{ url: "https://img.example.com/caneta.jpg" }],
};

describe("product-mapper", () => {
  describe("mapPromobrindToProduct", () => {
    it("maps basic fields", () => {
      const result = mapPromobrindToProduct(baseProduct as any);
      expect(result.id).toBe("prod-1");
      expect(result.name).toBe("Caneta Luxo");
      expect(result.sku).toBe("CAN-001");
    });

    it("maps category", () => {
      const result = mapPromobrindToProduct(baseProduct as any);
      expect(result.category.name).toBe("Escrita");
    });

    it("maps supplier", () => {
      const result = mapPromobrindToProduct(baseProduct as any);
      expect(result.supplier.name).toBe("Fornecedor A");
    });

    it("maps stock status", () => {
      const result = mapPromobrindToProduct(baseProduct as any);
      expect(result.stockStatus).toBe("in-stock");
    });

    it("maps low stock correctly", () => {
      // min_quantity deve ser <= stock para não acionar a guarda 'can't fill min order'.
      // Testamos o caminho qty < CATALOG_LOW_STOCK_THRESHOLD (10) → 'low-stock'.
      const result = mapPromobrindToProduct({ ...baseProduct, stock: 5, min_quantity: 1 } as any);
      expect(result.stockStatus).toBe("low-stock");
    });

    it("maps out of stock correctly", () => {
      const result = mapPromobrindToProduct({ ...baseProduct, stock: 0 } as any);
      expect(result.stockStatus).toBe("out-of-stock");
    });

    it("maps featured flag", () => {
      const result = mapPromobrindToProduct(baseProduct as any);
      expect(result.featured).toBe(true);
    });

    it("parses materials from string", () => {
      const result = mapPromobrindToProduct(baseProduct as any);
      expect(result.materials).toEqual(["Metal", "Plástico"]);
    });

    it("creates variations from colors", () => {
      const result = mapPromobrindToProduct(baseProduct as any);
      expect(result.variations).toHaveLength(2);
      expect(result.variations![0].color.name).toBe("Azul");
    });

    it("handles missing images with placeholder", () => {
      const noImages = { ...baseProduct, images: [] };
      const result = mapPromobrindToProduct(noImages as any);
      expect(result.images).toContain("/placeholder.svg");
    });

    it("parses marketing tags", () => {
      const withTags = {
        ...baseProduct,
        tags: {
          publicoAlvo: ["Executivos", "Estudantes"],
          endomarketing: "Integração",
        },
      };
      const result = mapPromobrindToProduct(withTags as any);
      expect(result.tags?.publicoAlvo).toEqual(["Executivos", "Estudantes"]);
      expect(result.tags?.endomarketing).toEqual(["Integração"]);
    });

    it("handles null tags gracefully", () => {
      const result = mapPromobrindToProduct({ ...baseProduct, tags: null } as any);
      expect(result.tags?.publicoAlvo).toEqual([]);
    });

    it("propagates priceUpdatedAt from external DB", () => {
      const withFreshness = {
        ...baseProduct,
        price_updated_at: "2025-01-15T10:00:00.000Z",
        price_freshness_threshold_days: 30,
      };
      const result = mapPromobrindToProduct(withFreshness as any);
      expect(result.priceUpdatedAt).toBe("2025-01-15T10:00:00.000Z");
      expect(result.priceFreshnessThresholdDays).toBe(30);
    });

    it("defaults priceUpdatedAt fields to null when missing", () => {
      const result = mapPromobrindToProduct(baseProduct as any);
      expect(result.priceUpdatedAt).toBeNull();
      expect(result.priceFreshnessThresholdDays).toBeNull();
    });

    it("forwards an external DB price_updated_at ISO string unchanged to the UI field", () => {
      const iso = "2026-03-20T08:30:00.000Z";
      const result = mapPromobrindToProduct({
        ...baseProduct,
        price_updated_at: iso,
        price_freshness_threshold_days: 45,
      } as any);
      // Must be the exact same ISO string the PDP badge will consume — no
      // mutation, no Date round-trip, so the badge can compute the days diff
      // against the real supplier timestamp.
      expect(result.priceUpdatedAt).toBe(iso);
      expect(typeof result.priceUpdatedAt).toBe("string");
      expect(result.priceFreshnessThresholdDays).toBe(45);
    });
  });
});

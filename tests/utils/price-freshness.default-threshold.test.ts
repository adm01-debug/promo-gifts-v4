/**
 * Cenário SSOT real (24/04/2026):
 *  - O BD externo populou `price_updated_at` em ~99,92% dos produtos (via trigger).
 *  - O BD externo NÃO possui a coluna `price_freshness_threshold_days`.
 *
 * Estes testes blindam o contrato:
 *  - Quando `price_updated_at` chega válido e `price_freshness_threshold_days`
 *    está ausente em qualquer forma (null/undefined/0/negativo/NaN/string),
 *    o util DEVE cair no default global de 60 dias.
 *  - O `mapPromobrindToProduct` DEVE propagar `priceFreshnessThresholdDays`
 *    como `null` quando o campo não existir, permitindo que o util aplique o default.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  getPriceFreshness,
  DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS,
} from "@/utils/price-freshness";
import { mapPromobrindToProduct } from "@/utils/product-mapper";

vi.mock("@/lib/external-db", () => ({
  getProductImageUrl: (p: any) => p.images?.[0]?.url || "/placeholder.svg",
  getProductPrice: (p: any) => p.price || 0,
  getProductStock: (p: any) => p.stock ?? 0,
}));

vi.mock("@/utils/product-colors", () => ({
  normalizeColors: () => [],
}));

const FIXED_NOW = new Date("2026-04-24T12:00:00.000Z").getTime();
const daysAgo = (d: number) => new Date(FIXED_NOW - d * 86400000).toISOString();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

describe("getPriceFreshness — default 60d quando threshold não existe", () => {
  it("garante que a constante default vale 60 dias (contrato público)", () => {
    expect(DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS).toBe(60);
  });

  it("usa default 60d quando threshold é null (cenário real do BD externo)", () => {
    const r = getPriceFreshness(daysAgo(20), null);
    expect(r.thresholdDays).toBe(60);
    expect(r.status).toBe("fresh"); // 20d ≤ 30d (50% de 60)
  });

  it("usa default 60d quando threshold é undefined (campo ausente do payload)", () => {
    const r = getPriceFreshness(daysAgo(20), undefined);
    expect(r.thresholdDays).toBe(60);
    expect(r.status).toBe("fresh");
  });

  it("usa default 60d quando threshold é 0 (valor inválido vindo do BD)", () => {
    const r = getPriceFreshness(daysAgo(45), 0);
    expect(r.thresholdDays).toBe(60);
    expect(r.status).toBe("aging"); // 45d ∈ (30, 60]
  });

  it("usa default 60d quando threshold é negativo", () => {
    const r = getPriceFreshness(daysAgo(45), -10);
    expect(r.thresholdDays).toBe(60);
    expect(r.status).toBe("aging");
  });

  it("usa default 60d quando threshold é NaN", () => {
    const r = getPriceFreshness(daysAgo(45), Number.NaN);
    expect(r.thresholdDays).toBe(60);
    expect(r.status).toBe("aging");
  });

  it("classifica corretamente em torno do default 60d quando threshold ausente", () => {
    // Bordas exatas do default 60: ≤30 fresh, 31..59 aging, ≥60 stale (BUG-008)
    expect(getPriceFreshness(daysAgo(0), null).status).toBe("fresh");
    expect(getPriceFreshness(daysAgo(30), null).status).toBe("fresh");
    expect(getPriceFreshness(daysAgo(31), null).status).toBe("aging");
    expect(getPriceFreshness(daysAgo(60), null).status).toBe("stale");
    expect(getPriceFreshness(daysAgo(61), null).status).toBe("stale");
    expect(getPriceFreshness(daysAgo(120), null).status).toBe("stale");
  });

  it("tooltip cita explicitamente 'Validade configurada: 60 dias' no fallback default", () => {
    const r = getPriceFreshness(daysAgo(10), null);
    expect(r.tooltip).toMatch(/Validade configurada: 60 dias/);
  });
});

describe("mapPromobrindToProduct — propaga threshold ausente como null", () => {
  function makeRaw(overrides: Record<string, unknown> = {}) {
    return {
      id: "p-1",
      name: "Caneta",
      sku: "CAN-1",
      price: 10,
      stock: 50,
      images: [{ url: "/x.png" }],
      colors: [],
      is_active: true,
      price_updated_at: daysAgo(10),
      // price_freshness_threshold_days deliberadamente OMITIDO
      ...overrides,
    };
  }

  it("propaga null quando o campo está ausente do payload externo", () => {
    const product = mapPromobrindToProduct(makeRaw() as any);
    expect(product.priceUpdatedAt).toBeTruthy();
    expect(product.priceFreshnessThresholdDays).toBeNull();
  });

  it("propaga null quando o campo vem explicitamente null", () => {
    const product = mapPromobrindToProduct(
      makeRaw({ price_freshness_threshold_days: null }) as any,
    );
    expect(product.priceFreshnessThresholdDays).toBeNull();
  });

  it("preserva valores válidos quando o campo existir (futuro-proof)", () => {
    const product = mapPromobrindToProduct(
      makeRaw({ price_freshness_threshold_days: 30 }) as any,
    );
    expect(product.priceFreshnessThresholdDays).toBe(30);
  });

  it("ponta-a-ponta: produto real do catálogo cai no default 60d via util", () => {
    const product = mapPromobrindToProduct(
      makeRaw({ price_updated_at: daysAgo(45) }) as any,
    );
    // Mapper devolve null → util aplica default 60d → 45d ∈ aging
    const f = getPriceFreshness(
      product.priceUpdatedAt,
      product.priceFreshnessThresholdDays,
    );
    expect(f.thresholdDays).toBe(60);
    expect(f.status).toBe("aging");
  });

  it("ponta-a-ponta: 70d sem threshold cai como stale sob o default 60d", () => {
    const product = mapPromobrindToProduct(
      makeRaw({ price_updated_at: daysAgo(70) }) as any,
    );
    const f = getPriceFreshness(
      product.priceUpdatedAt,
      product.priceFreshnessThresholdDays,
    );
    expect(f.thresholdDays).toBe(60);
    expect(f.status).toBe("stale");
    expect(f.isStale).toBe(true);
  });
});

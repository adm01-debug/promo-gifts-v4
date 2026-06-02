/**
 * freight-quest: Testes unitários para lógica de cálculo de frete
 *
 * Cobre:
 *  - FreightEstimator: tabela SEDEX, PAC, Transportadora
 *  - Faixas de peso em todas as transições
 *  - Cálculos por quantidade de kits
 *  - Edge cases: peso 0, peso extremo, quantidade negativa
 *  - QuoteTotals: cálculo de total com shipping CIF/FOB/FOB_PRE
 */
import { describe, expect, it } from "vitest";

// ─── Lógica extraída do FreightEstimator (espelha src/components/kit-builder/FreightEstimator.tsx) ──

const FREIGHT_TABLE = {
  sedex: [
    { maxKg: 1, price: 22.5 },
    { maxKg: 5, price: 35.0 },
    { maxKg: 10, price: 55.0 },
    { maxKg: 30, price: 95.0 },
    { maxKg: Infinity, price: 150.0 },
  ],
  pac: [
    { maxKg: 1, price: 15.0 },
    { maxKg: 5, price: 22.0 },
    { maxKg: 10, price: 35.0 },
    { maxKg: 30, price: 60.0 },
    { maxKg: Infinity, price: 95.0 },
  ],
  transportadora: [
    { maxKg: 5, price: 18.0 },
    { maxKg: 10, price: 28.0 },
    { maxKg: 30, price: 45.0 },
    { maxKg: 100, price: 80.0 },
    { maxKg: Infinity, price: 120.0 },
  ],
};

type FreightMethod = keyof typeof FREIGHT_TABLE;

function calcFreight(
  weightGrams: number,
  quantity: number,
  method: FreightMethod,
): { totalWeightKg: number; pricePerShipment: number } {
  const safeWeight = Math.max(0, weightGrams);
  const safeQty = Math.max(1, quantity);
  const totalWeightKg = (safeWeight * safeQty) / 1000;
  const table = FREIGHT_TABLE[method];
  const pricePerShipment =
    table.find((r) => totalWeightKg <= r.maxKg)?.price ?? table[table.length - 1].price;
  return { totalWeightKg, pricePerShipment };
}

// ─── SEDEX ────────────────────────────────────────────────────────────────────

describe("FreightEstimator — SEDEX", () => {
  it("0g → R$ 22,50 (faixa ≤ 1kg)", () => {
    expect(calcFreight(0, 1, "sedex").pricePerShipment).toBe(22.5);
  });

  it("500g, 1 kit → R$ 22,50 (≤ 1kg)", () => {
    expect(calcFreight(500, 1, "sedex").pricePerShipment).toBe(22.5);
  });

  it("1000g, 1 kit → R$ 22,50 (exatamente 1kg, faixa ≤ 1kg)", () => {
    expect(calcFreight(1000, 1, "sedex").pricePerShipment).toBe(22.5);
  });

  it("1001g, 1 kit → R$ 35,00 (faixa ≤ 5kg)", () => {
    expect(calcFreight(1001, 1, "sedex").pricePerShipment).toBe(35.0);
  });

  it("500g, 10 kits → 5kg total → R$ 35,00 (exatamente 5kg)", () => {
    const result = calcFreight(500, 10, "sedex");
    expect(result.totalWeightKg).toBe(5);
    expect(result.pricePerShipment).toBe(35.0);
  });

  it("600g, 10 kits → 6kg → R$ 55,00 (faixa ≤ 10kg)", () => {
    const result = calcFreight(600, 10, "sedex");
    expect(result.totalWeightKg).toBe(6);
    expect(result.pricePerShipment).toBe(55.0);
  });

  it("1500g, 20 kits → 30kg → R$ 95,00 (exatamente 30kg)", () => {
    const result = calcFreight(1500, 20, "sedex");
    expect(result.totalWeightKg).toBe(30);
    expect(result.pricePerShipment).toBe(95.0);
  });

  it("1501g, 20 kits → acima de 30kg → R$ 150,00 (faixa Infinity)", () => {
    const result = calcFreight(1501, 20, "sedex");
    expect(result.pricePerShipment).toBe(150.0);
  });

  it("peso extremo 100kg → R$ 150,00 (faixa Infinity)", () => {
    expect(calcFreight(100_000, 1, "sedex").pricePerShipment).toBe(150.0);
  });
});

// ─── PAC ──────────────────────────────────────────────────────────────────────

describe("FreightEstimator — PAC", () => {
  it("200g, 1 kit → R$ 15,00 (≤ 1kg)", () => {
    expect(calcFreight(200, 1, "pac").pricePerShipment).toBe(15.0);
  });

  it("3000g, 1 kit → R$ 22,00 (≤ 5kg)", () => {
    expect(calcFreight(3000, 1, "pac").pricePerShipment).toBe(22.0);
  });

  it("7000g, 1 kit → R$ 35,00 (≤ 10kg)", () => {
    expect(calcFreight(7000, 1, "pac").pricePerShipment).toBe(35.0);
  });

  it("20000g, 1 kit → R$ 60,00 (≤ 30kg)", () => {
    expect(calcFreight(20000, 1, "pac").pricePerShipment).toBe(60.0);
  });

  it("35000g, 1 kit → R$ 95,00 (> 30kg)", () => {
    expect(calcFreight(35000, 1, "pac").pricePerShipment).toBe(95.0);
  });

  it("PAC sempre mais barato que SEDEX para mesmo peso", () => {
    const weights = [500, 2000, 5000, 8000, 25000, 40000];
    for (const w of weights) {
      const pac = calcFreight(w, 1, "pac").pricePerShipment;
      const sedex = calcFreight(w, 1, "sedex").pricePerShipment;
      expect(pac).toBeLessThanOrEqual(sedex);
    }
  });
});

// ─── Transportadora ───────────────────────────────────────────────────────────

describe("FreightEstimator — Transportadora", () => {
  it("1000g, 1 kit → R$ 18,00 (≤ 5kg)", () => {
    expect(calcFreight(1000, 1, "transportadora").pricePerShipment).toBe(18.0);
  });

  it("7500g, 1 kit → R$ 28,00 (≤ 10kg)", () => {
    expect(calcFreight(7500, 1, "transportadora").pricePerShipment).toBe(28.0);
  });

  it("20kg → R$ 45,00", () => {
    expect(calcFreight(20000, 1, "transportadora").pricePerShipment).toBe(45.0);
  });

  it("75kg → R$ 80,00 (≤ 100kg)", () => {
    expect(calcFreight(75000, 1, "transportadora").pricePerShipment).toBe(80.0);
  });

  it("150kg → R$ 120,00 (> 100kg)", () => {
    expect(calcFreight(150000, 1, "transportadora").pricePerShipment).toBe(120.0);
  });
});

// ─── Edge cases: quantidade ───────────────────────────────────────────────────

describe("FreightEstimator — edge cases quantidade", () => {
  it("quantidade 0 → sanitizado para 1 (não divide por zero)", () => {
    const result = calcFreight(1000, 0, "sedex");
    expect(result.totalWeightKg).toBe(1);
    expect(result.pricePerShipment).toBe(22.5);
  });

  it("quantidade negativa → sanitizado para 1", () => {
    const result = calcFreight(1000, -5, "pac");
    expect(result.totalWeightKg).toBe(1);
    expect(result.pricePerShipment).toBe(15.0);
  });

  it("quantidade 100 kits de 500g → 50kg total → R$ 150 SEDEX", () => {
    const result = calcFreight(500, 100, "sedex");
    expect(result.totalWeightKg).toBe(50);
    expect(result.pricePerShipment).toBe(150.0);
  });
});

// ─── Quote totals com shipping ────────────────────────────────────────────────

type ShippingType = "cif" | "fob" | "fob_pre";

interface QuoteTotalsInput {
  subtotal: number;
  discountPercent: number;
  shippingType: ShippingType;
  shippingCost: number;
}

function calcQuoteTotals(input: QuoteTotalsInput): {
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  shippingAdded: number;
  total: number;
} {
  const { subtotal, discountPercent, shippingType, shippingCost } = input;
  const discountAmount = parseFloat(((subtotal * discountPercent) / 100).toFixed(2));
  const afterDiscount = parseFloat((subtotal - discountAmount).toFixed(2));
  const shippingAdded = shippingType === "fob_pre" ? shippingCost : 0;
  const total = parseFloat((afterDiscount + shippingAdded).toFixed(2));
  return { subtotal, discountAmount, afterDiscount, shippingAdded, total };
}

describe("QuoteTotals — cálculo com shipping", () => {
  it("CIF: frete não entra no total (cortesia)", () => {
    const result = calcQuoteTotals({
      subtotal: 1000,
      discountPercent: 0,
      shippingType: "cif",
      shippingCost: 150,
    });
    expect(result.shippingAdded).toBe(0);
    expect(result.total).toBe(1000);
  });

  it("FOB (cliente paga): frete não entra no total", () => {
    const result = calcQuoteTotals({
      subtotal: 1000,
      discountPercent: 0,
      shippingType: "fob",
      shippingCost: 0,
    });
    expect(result.shippingAdded).toBe(0);
    expect(result.total).toBe(1000);
  });

  it("FOB pré-negociado: frete entra no total", () => {
    const result = calcQuoteTotals({
      subtotal: 1000,
      discountPercent: 0,
      shippingType: "fob_pre",
      shippingCost: 150,
    });
    expect(result.shippingAdded).toBe(150);
    expect(result.total).toBe(1150);
  });

  it("FOB pré-negociado + desconto 10%", () => {
    const result = calcQuoteTotals({
      subtotal: 1000,
      discountPercent: 10,
      shippingType: "fob_pre",
      shippingCost: 100,
    });
    expect(result.discountAmount).toBe(100);
    expect(result.afterDiscount).toBe(900);
    expect(result.shippingAdded).toBe(100);
    expect(result.total).toBe(1000);
  });

  it("subtotal zero com frete → total = frete (fob_pre)", () => {
    const result = calcQuoteTotals({
      subtotal: 0,
      discountPercent: 0,
      shippingType: "fob_pre",
      shippingCost: 35.5,
    });
    expect(result.total).toBe(35.5);
  });

  it("desconto 100% → afterDiscount = 0 (mesmo com fob_pre, total = frete)", () => {
    const result = calcQuoteTotals({
      subtotal: 500,
      discountPercent: 100,
      shippingType: "fob_pre",
      shippingCost: 50,
    });
    expect(result.afterDiscount).toBe(0);
    expect(result.total).toBe(50);
  });

  it("arredondamento correto: 1/3 de desconto", () => {
    const result = calcQuoteTotals({
      subtotal: 100,
      discountPercent: 33.333,
      shippingType: "cif",
      shippingCost: 0,
    });
    expect(result.discountAmount).toBe(33.33);
    expect(result.afterDiscount).toBe(66.67);
  });
});

// ─── Propriedades invariantes ──────────────────────────────────────────────────

describe("FreightEstimator — propriedades invariantes", () => {
  it("preço nunca é negativo", () => {
    const testCases = [
      { w: 0, q: 1 },
      { w: 100, q: 1 },
      { w: 1000000, q: 1 },
    ];
    for (const { w, q } of testCases) {
      for (const method of ["sedex", "pac", "transportadora"] as FreightMethod[]) {
        const { pricePerShipment } = calcFreight(w, q, method);
        expect(pricePerShipment).toBeGreaterThan(0);
      }
    }
  });

  it("preço cresce monotonicamente com o peso (mesmas faixas)", () => {
    const weights = [500, 2000, 6000, 15000, 31000];
    for (const method of ["sedex", "pac", "transportadora"] as FreightMethod[]) {
      let prevPrice = 0;
      for (const w of weights) {
        const { pricePerShipment } = calcFreight(w, 1, method);
        expect(pricePerShipment).toBeGreaterThanOrEqual(prevPrice);
        prevPrice = pricePerShipment;
      }
    }
  });

  it("peso total = weightGrams × kitQuantity / 1000", () => {
    const w = 750;
    const q = 4;
    const result = calcFreight(w, q, "sedex");
    expect(result.totalWeightKg).toBeCloseTo((w * q) / 1000, 6);
  });
});

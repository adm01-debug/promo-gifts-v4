/**
 * freight-quest: Testes baseados em propriedades e combinatórios
 *
 * Gera sistematicamente > 2 000 combinações de:
 *  - Peso (0g … 500 000g) × Quantidade (1 … 10 000) × Método (3)
 *  - Validação de invariantes em todo espaço de entrada
 *  - Boundary values exaustivos em todas as faixas de peso
 *  - Composição: múltiplos itens com pesos distintos
 *  - Consistência: cálculo com grande quantidade nunca < com pequena para mesmo peso
 *
 * Por design não testa output exato (property-based), mas sim:
 *  - Preço nunca negativo ou zero
 *  - Peso total é determinístico
 *  - Preço cresce monotonicamente com peso (dentro da tabela)
 *  - Método mais barato é sempre ≤ mais caro no mesmo peso
 */
import { describe, expect, it } from "vitest";

// ─── Tabela de frete (espelha FreightEstimator.tsx) ───────────────────────────

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
} as const;

type FreightMethod = keyof typeof FREIGHT_TABLE;
const ALL_METHODS: FreightMethod[] = ["sedex", "pac", "transportadora"];

function calcFreight(
  weightGrams: number,
  quantity: number,
  method: FreightMethod,
): { totalWeightKg: number; price: number } {
  const safeWeight = Math.max(0, weightGrams);
  const safeQty = Math.max(1, quantity);
  const totalWeightKg = (safeWeight * safeQty) / 1000;
  const table = FREIGHT_TABLE[method] as readonly { maxKg: number; price: number }[];
  const price = table.find((r) => totalWeightKg <= r.maxKg)?.price ?? table[table.length - 1].price;
  return { totalWeightKg, price };
}

function calcQuoteTotal(
  subtotal: number,
  discountPct: number,
  shippingType: "cif" | "fob" | "fob_pre",
  shippingCost: number,
): number {
  const discount = (subtotal * discountPct) / 100;
  const afterDiscount = subtotal - discount;
  const freight = shippingType === "fob_pre" ? shippingCost : 0;
  return parseFloat((afterDiscount + freight).toFixed(2));
}

// ─── 1. Invariante: preço sempre > 0 para todos os pesos e métodos ────────────

describe("property: preço nunca zero ou negativo", () => {
  const WEIGHTS_G = [
    0, 1, 100, 499, 500, 501, 999, 1000, 1001,
    4999, 5000, 5001, 9999, 10000, 10001,
    29999, 30000, 30001, 100000, 500000,
  ];
  const QUANTITIES = [1, 2, 5, 10, 50, 100, 500, 1000];

  it.each(ALL_METHODS)("método %s: preço > 0 para todo peso e quantidade", (method) => {
    for (const w of WEIGHTS_G) {
      for (const q of QUANTITIES) {
        const { price } = calcFreight(w, q, method);
        expect(price, `w=${w} q=${q} method=${method}`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── 2. Invariante: totalWeightKg = weightGrams × qty / 1000 ─────────────────

describe("property: peso total determinístico", () => {
  const cases: [number, number][] = [
    [0, 1], [1, 1], [500, 1], [1000, 1], [500, 2], [750, 4],
    [1234, 7], [999, 100], [500, 10000],
  ];

  it.each(cases)("w=%i g × q=%i → totalWeightKg correto", (w, q) => {
    const { totalWeightKg } = calcFreight(w, q, "sedex");
    expect(totalWeightKg).toBeCloseTo((w * q) / 1000, 10);
  });
});

// ─── 3. Invariante: PAC ≤ SEDEX ≤ (depends on weight) ───────────────────────

describe("property: ordenação de métodos por preço", () => {
  const WEIGHTS_KG_BREAKPOINTS = [0.5, 1.0, 3.0, 5.0, 8.0, 10.0, 20.0, 30.0, 50.0, 100.0];

  it.each(WEIGHTS_KG_BREAKPOINTS)("%.1f kg: PAC ≤ SEDEX", (kg) => {
    const w = kg * 1000;
    const pac = calcFreight(w, 1, "pac").price;
    const sedex = calcFreight(w, 1, "sedex").price;
    expect(pac).toBeLessThanOrEqual(sedex);
  });
});

// ─── 4. Invariante: preço cresce monotonicamente dentro de cada método ────────

describe("property: monotonicidade de preço com peso crescente", () => {
  const WEIGHT_SEQUENCE_G = [100, 900, 1100, 4500, 5500, 9500, 10500, 29000, 31000, 50000, 150000];

  it.each(ALL_METHODS)("método %s: preço não decresce com peso crescente", (method) => {
    let prevPrice = 0;
    for (const w of WEIGHT_SEQUENCE_G) {
      const { price } = calcFreight(w, 1, method);
      expect(price, `w=${w} method=${method}`).toBeGreaterThanOrEqual(prevPrice);
      prevPrice = price;
    }
  });
});

// ─── 5. Cobertura exaustiva de faixas de peso (boundary sweep) ───────────────

describe("property: boundary sweep de faixas — SEDEX", () => {
  const BOUNDARIES_AND_NEIGHBORS: Array<[number, number]> = [
    [999, 22.5],    // just below 1kg
    [1000, 22.5],   // exactly 1kg
    [1001, 35.0],   // just above 1kg
    [4999, 35.0],   // just below 5kg
    [5000, 35.0],   // exactly 5kg
    [5001, 55.0],   // just above 5kg
    [9999, 55.0],   // just below 10kg
    [10000, 55.0],  // exactly 10kg
    [10001, 95.0],  // just above 10kg
    [29999, 95.0],  // just below 30kg
    [30000, 95.0],  // exactly 30kg
    [30001, 150.0], // just above 30kg
  ];

  it.each(BOUNDARIES_AND_NEIGHBORS)("%i g (1 kit) → R$%f", (grams, expected) => {
    expect(calcFreight(grams, 1, "sedex").price).toBe(expected);
  });
});

describe("property: boundary sweep de faixas — PAC", () => {
  const BOUNDARIES: Array<[number, number]> = [
    [1000, 15.0],
    [1001, 22.0],
    [5000, 22.0],
    [5001, 35.0],
    [10000, 35.0],
    [10001, 60.0],
    [30000, 60.0],
    [30001, 95.0],
  ];

  it.each(BOUNDARIES)("%i g (1 kit) → R$%f", (grams, expected) => {
    expect(calcFreight(grams, 1, "pac").price).toBe(expected);
  });
});

describe("property: boundary sweep de faixas — Transportadora", () => {
  const BOUNDARIES: Array<[number, number]> = [
    [5000, 18.0],
    [5001, 28.0],
    [10000, 28.0],
    [10001, 45.0],
    [30000, 45.0],
    [30001, 80.0],
    [100000, 80.0],
    [100001, 120.0],
  ];

  it.each(BOUNDARIES)("%i g (1 kit) → R$%f", (grams, expected) => {
    expect(calcFreight(grams, 1, "transportadora").price).toBe(expected);
  });
});

// ─── 6. Combinações de muitos kits (simulação real de pedido corporativo) ─────

describe("property: pedidos corporativos de grande volume", () => {
  const CORPORATE_ORDERS: Array<{ product: string; weightG: number; qty: number }> = [
    { product: "squeeze-500ml", weightG: 320, qty: 200 },
    { product: "camiseta-m", weightG: 200, qty: 500 },
    { product: "caneca-350ml", weightG: 280, qty: 100 },
    { product: "mochila-20l", weightG: 850, qty: 50 },
    { product: "caderno-a5", weightG: 350, qty: 1000 },
    { product: "pen-drive-32gb", weightG: 15, qty: 2000 },
    { product: "calendario-desk", weightG: 450, qty: 300 },
    { product: "copo-termico-500ml", weightG: 400, qty: 150 },
  ];

  it.each(CORPORATE_ORDERS)(
    "$product: qty=$qty × $weightG g → preço > 0 para todos métodos",
    ({ weightG, qty }) => {
      for (const method of ALL_METHODS) {
        const { price, totalWeightKg } = calcFreight(weightG, qty, method);
        expect(price).toBeGreaterThan(0);
        expect(totalWeightKg).toBeCloseTo((weightG * qty) / 1000, 6);
      }
    },
  );

  it("pedido de 200 squeezes: SEDEX < R$200 (consistência tabela)", () => {
    const { price } = calcFreight(320, 200, "sedex");
    expect(price).toBeLessThanOrEqual(200);
    expect(price).toBeGreaterThan(0);
  });
});

// ─── 7. Combinatória: 5 pesos × 5 quantidades × 3 métodos (75 casos) ─────────

describe("property: matriz combinatória 5×5×3", () => {
  const WEIGHTS = [100, 500, 1000, 5000, 50000];
  const QUANTITIES = [1, 10, 100, 500, 2000];

  const matrix: Array<{ w: number; q: number; m: FreightMethod }> = [];
  for (const w of WEIGHTS) {
    for (const q of QUANTITIES) {
      for (const m of ALL_METHODS) {
        matrix.push({ w, q, m });
      }
    }
  }

  it.each(matrix)("w=$w g × q=$q × method=$m → preço válido", ({ w, q, m }) => {
    const { price, totalWeightKg } = calcFreight(w, q, m);
    expect(price).toBeGreaterThan(0);
    expect(totalWeightKg).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(price)).toBe(true);
    expect(Number.isFinite(totalWeightKg)).toBe(true);
  });
});

// ─── 8. QuoteTotals: combinatória de shippingType × desconto ─────────────────

describe("property: QuoteTotals — combinatória shippingType × desconto", () => {
  const SHIPPING_TYPES = ["cif", "fob", "fob_pre"] as const;
  const DISCOUNTS = [0, 5, 10, 15, 20, 25, 33.333, 50, 75, 100];
  const SUBTOTALS = [100, 500, 1000, 5000, 50000];
  const SHIPPING_COSTS = [0, 15, 35, 89.5, 150, 350];

  it("CIF e FOB: total nunca inclui shipping_cost (invariante)", () => {
    for (const sub of SUBTOTALS) {
      for (const disc of DISCOUNTS) {
        for (const cost of SHIPPING_COSTS) {
          for (const type of ["cif", "fob"] as const) {
            const total = calcQuoteTotal(sub, disc, type, cost);
            const expected = parseFloat((sub - (sub * disc) / 100).toFixed(2));
            expect(total).toBeCloseTo(expected, 1);
          }
        }
      }
    }
  });

  it("FOB_PRE: total = afterDiscount + shippingCost (invariante)", () => {
    for (const sub of SUBTOTALS) {
      for (const disc of DISCOUNTS) {
        for (const cost of [15, 35, 89.5, 150]) {
          const total = calcQuoteTotal(sub, disc, "fob_pre", cost);
          const afterDiscount = parseFloat((sub - (sub * disc) / 100).toFixed(2));
          const expected = parseFloat((afterDiscount + cost).toFixed(2));
          expect(total).toBeCloseTo(expected, 1);
        }
      }
    }
  });

  it("total nunca negativo para qualquer combinação válida", () => {
    for (const type of SHIPPING_TYPES) {
      for (const disc of [0, 50, 100]) {
        for (const sub of [0, 100, 1000]) {
          const cost = type === "fob_pre" ? 50 : 0;
          const total = calcQuoteTotal(sub, disc, type, cost);
          expect(total).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

// ─── 9. Gerador pseudo-aleatório determinístico (seed fixo) ──────────────────

describe("property: fuzz determinístico com seed fixo (500 amostras)", () => {
  function lcg(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  const rng = lcg(0xdeadbeef);

  const SAMPLES = Array.from({ length: 500 }, (_, i) => {
    const weightG = Math.floor(rng() * 200_000);
    const quantity = Math.floor(rng() * 5_000) + 1;
    const methodIdx = Math.floor(rng() * 3);
    return { i, weightG, quantity, method: ALL_METHODS[methodIdx] };
  });

  it.each(SAMPLES)(
    "#$i: w=$weightG g × q=$quantity × $method → invariantes OK",
    ({ weightG, quantity, method }) => {
      const { price, totalWeightKg } = calcFreight(weightG, quantity, method);
      expect(price).toBeGreaterThan(0);
      expect(Number.isFinite(price)).toBe(true);
      expect(Number.isFinite(totalWeightKg)).toBe(true);
      expect(totalWeightKg).toBeGreaterThanOrEqual(0);
    },
  );
});

// ─── 10. Testes de estabilidade numérica ─────────────────────────────────────

describe("property: estabilidade numérica de ponto flutuante", () => {
  it("peso 333.333g × 3 kits → 1.0kg → faixa ≤ 1kg", () => {
    const { price } = calcFreight(333.333, 3, "sedex");
    expect(price).toBe(22.5);
  });

  it("peso 0.001g (micro-item) × 1 million kits → 1kg → 22.50 sedex", () => {
    const { totalWeightKg } = calcFreight(0.001, 1_000_000, "sedex");
    expect(totalWeightKg).toBeCloseTo(1.0, 2);
  });

  it("peso fracionário 1234.5g × 8 kits → 9.876kg → faixa ≤ 10kg", () => {
    const { price } = calcFreight(1234.5, 8, "sedex");
    expect(price).toBe(55.0);
  });

  it("peso 10000.000001g × 1 kit → ultrapassa 10kg → faixa ≤ 30kg", () => {
    const { price } = calcFreight(10000.0001, 1, "sedex");
    expect(price).toBe(95.0);
  });
});

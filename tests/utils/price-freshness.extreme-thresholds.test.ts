/**
 * Thresholds extremos — limites operacionais do `getPriceFreshness`.
 *
 * Os arquivos `price-freshness.test.ts` e `price-freshness-coverage.test.ts`
 * já cobrem o caminho feliz (30/45/60/90). Aqui blindamos as bordas que
 * o admin pode configurar acidentalmente ou de propósito:
 *
 *   1. **Thresholds inválidos** (0, negativos, NaN) → caem no default 60d
 *      (já coberto em `default-threshold.test.ts`, replicado aqui para
 *      garantir interação com o cálculo de status).
 *   2. **Threshold = 1 dia** (caso operacional mais agressivo possível,
 *      ex.: produtos cotados em dólar com volatilidade alta):
 *        - `Math.floor(1/2) = 0` → metade vira 0
 *        - regra (BUG-008): stale quando days >= threshold -> dia 1 já é stale
 *        - não há zona aging com threshold=1 (floor(1/2)=0, e 1 >= 1)
 *        - hoje (0d) ainda é fresh
 *   3. **Threshold = 365 dias** (catálogo institucional, preços anuais):
 *        - metade = 182, então aging começa em 183
 *        - stale a partir de 365 (BUG-008: days >= threshold)
 *   4. **Tooltips** sempre citam o threshold configurado, mesmo nos
 *      extremos (validação de copy para não quebrar UX em casos raros).
 *   5. **Frações** (ex.: 1.7) são truncadas via `Math.floor` antes de
 *      classificar — contrato documentado do util.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  getPriceFreshness,
  DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS,
} from "@/utils/price-freshness";

const FIXED_NOW = new Date("2025-06-15T12:00:00.000Z").getTime();
const daysAgo = (d: number) => new Date(FIXED_NOW - d * 86400000).toISOString();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

describe("getPriceFreshness — thresholds inválidos voltam ao default 60d", () => {
  it.each([
    { label: "zero", value: 0 },
    { label: "negativo", value: -5 },
    { label: "NaN", value: Number.NaN },
    { label: "null", value: null },
    { label: "undefined", value: undefined },
  ])("threshold $label → default 60d e classifica corretamente", ({ value }) => {
    const r = getPriceFreshness(daysAgo(45), value as number | null | undefined);
    expect(r.thresholdDays).toBe(DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS);
    // 45d sob default 60: ∈ (30, 60] → aging
    expect(r.status).toBe("aging");
    expect(r.tooltip).toContain("Validade configurada: 60 dias");
  });
});

describe("getPriceFreshness — threshold = 1 dia (cotação volátil)", () => {
  it("hoje (0d) ainda é fresh — vendedor não é alarmado no mesmo dia", () => {
    const r = getPriceFreshness(daysAgo(0), 1);
    expect(r.thresholdDays).toBe(1);
    expect(r.status).toBe("fresh");
    expect(r.label).toBe("Atualizado hoje");
    expect(r.tooltip).toContain("Validade configurada: 1 dias");
    expect(r.tooltip).toMatch(/dentro do prazo/i);
  });

  it("1 dia atrás já é stale — exatamente no threshold (BUG-008: days >= threshold)", () => {
    // Regra (BUG-008): stale quando days >= threshold. 1 >= 1 -> stale.
    const r = getPriceFreshness(daysAgo(1), 1);
    expect(r.status).toBe("stale");
    expect(r.label).toBe("Preço pode estar defasado (há 1 dia)");
    expect(r.shouldWarn).toBe(true);
    expect(r.isStale).toBe(true);
    expect(r.tooltip).toMatch(/confirme o valor/i);
  });

  it("2 dias atrás já é stale — passou do limite mínimo", () => {
    const r = getPriceFreshness(daysAgo(2), 1);
    expect(r.status).toBe("stale");
    expect(r.isStale).toBe(true);
    expect(r.label).toMatch(/^Preço pode estar defasado \(há 2 dias\)$/);
    expect(r.tooltip).toMatch(/confirme o valor/i);
  });

  it("dias muito acima do threshold mantêm stale (sem overflow de classificação)", () => {
    const r = getPriceFreshness(daysAgo(500), 1);
    expect(r.status).toBe("stale");
    expect(r.daysSinceUpdate).toBe(500);
    expect(r.label).toContain("há 500 dias");
  });
});

describe("getPriceFreshness — threshold = 2 dias (borda do floor da metade)", () => {
  // Math.floor(2/2) = 1 → fresh até 1; dia 2 (>= threshold) já é stale (BUG-008)
  it("1 dia ainda é fresh (≤ floor(2/2)=1)", () => {
    expect(getPriceFreshness(daysAgo(1), 2).status).toBe("fresh");
  });
  it("2 dias já é stale (no threshold; BUG-008: days >= threshold)", () => {
    expect(getPriceFreshness(daysAgo(2), 2).status).toBe("stale");
  });
  it("3 dias é stale (passou do threshold)", () => {
    expect(getPriceFreshness(daysAgo(3), 2).status).toBe("stale");
  });
});

describe("getPriceFreshness — threshold = 365 dias (catálogo institucional)", () => {
  // Math.floor(365/2) = 182 → aging começa em 183
  it("182d ainda é fresh (≤ metade do threshold)", () => {
    const r = getPriceFreshness(daysAgo(182), 365);
    expect(r.thresholdDays).toBe(365);
    expect(r.status).toBe("fresh");
    expect(r.label).toBe("Atualizado há 182 dias");
    expect(r.tooltip).toContain("Validade configurada: 365 dias");
  });

  it("183d vira aging (logo após a metade)", () => {
    expect(getPriceFreshness(daysAgo(183), 365).status).toBe("aging");
  });

  it("365d já é stale (no threshold exato; BUG-008: days >= threshold)", () => {
    const r = getPriceFreshness(daysAgo(365), 365);
    expect(r.status).toBe("stale");
    expect(r.shouldWarn).toBe(true);
    expect(r.isStale).toBe(true);
  });

  it("366d vira stale (1 dia após o threshold anual)", () => {
    const r = getPriceFreshness(daysAgo(366), 365);
    expect(r.status).toBe("stale");
    expect(r.isStale).toBe(true);
    expect(r.label).toMatch(/^Preço pode estar defasado \(há 366 dias\)$/);
  });

  it("data muito antiga (5 anos) ainda classifica como stale sem erro", () => {
    const r = getPriceFreshness(daysAgo(365 * 5), 365);
    expect(r.status).toBe("stale");
    expect(r.daysSinceUpdate).toBe(365 * 5);
  });
});

describe("getPriceFreshness — threshold fracionário (truncado via Math.floor)", () => {
  it("threshold 1.9 é tratado como 1 (Math.floor)", () => {
    const r = getPriceFreshness(daysAgo(1), 1.9);
    expect(r.thresholdDays).toBe(1);
    // mesmo comportamento de threshold=1 com 1d → stale (BUG-008: days >= threshold)
    expect(r.status).toBe("stale");
  });

  it("threshold 60.7 é tratado como 60 (Math.floor)", () => {
    const r = getPriceFreshness(daysAgo(60), 60.7);
    expect(r.thresholdDays).toBe(60);
    expect(r.status).toBe("stale");
  });
});

describe("getPriceFreshness — tooltips sempre carregam o threshold configurado", () => {
  it.each([1, 2, 7, 30, 365, 730])(
    "threshold de %i dias aparece literalmente no tooltip",
    (t) => {
      const r = getPriceFreshness(daysAgo(0), t);
      expect(r.tooltip).toContain(`Validade configurada: ${t} dias`);
    },
  );
});

/**
 * Cobertura complementar para `getPriceFreshness`.
 *
 * Os arquivos `tests/utils/price-freshness.test.ts` e
 * `tests/components/PriceFreshnessBadge.test.tsx` já cobrem os 4 status
 * principais (unknown / fresh / aging / stale), data inválida, threshold
 * default e thresholds customizados.
 *
 * Aqui travamos:
 *   1. Bordas exatas do threshold (limite inferior do aging e o salto para
 *      stale exatamente no threshold — BUG-008: days >= threshold).
 *   2. Rótulos pt-BR canônicos: "hoje", "há 1 dia" (singular), "há N dias"
 *      (plural) e o copy curto unificado entre PDP e Quick View.
 *   3. Tooltip sempre em pt-BR longo ("DD de <mês> de AAAA") e contendo a
 *      janela de validade configurada.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getPriceFreshness } from "@/utils/price-freshness";

const FIXED_NOW = new Date("2025-06-15T12:00:00.000Z").getTime();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

const daysAgo = (d: number) =>
  new Date(FIXED_NOW - d * 86400000).toISOString();

describe("getPriceFreshness — bordas de threshold", () => {
  it("dia exatamente no meio do threshold ainda é 'fresh'", () => {
    // threshold=60 ⇒ metade=30. Regra: aging só começa quando days > 30.
    expect(getPriceFreshness(daysAgo(30), 60).status).toBe("fresh");
  });

  it("um dia após o meio do threshold vira 'aging'", () => {
    expect(getPriceFreshness(daysAgo(31), 60).status).toBe("aging");
  });

  it("dia exatamente no threshold já é 'stale' (BUG-008: days >= threshold)", () => {
    // Regra (BUG-008): stale quando days >= threshold.
    expect(getPriceFreshness(daysAgo(60), 60).status).toBe("stale");
  });

  it("um dia acima do threshold vira 'stale'", () => {
    expect(getPriceFreshness(daysAgo(61), 60).status).toBe("stale");
  });
});

describe("getPriceFreshness — rótulos pt-BR canônicos", () => {
  it("usa 'hoje' quando atualizado no mesmo dia", () => {
    const r = getPriceFreshness(new Date(FIXED_NOW).toISOString(), 60);
    expect(r.label.toLowerCase()).toBe("atualizado hoje");
  });

  it("usa singular 'há 1 dia' quando faz exatamente 1 dia", () => {
    const r = getPriceFreshness(daysAgo(1), 60);
    expect(r.label).toBe("Atualizado há 1 dia");
  });

  it("usa plural 'há N dias' para 2+ dias (fresh)", () => {
    const r = getPriceFreshness(daysAgo(7), 60);
    expect(r.label).toBe("Atualizado há 7 dias");
  });

  it("rótulo de stale usa o copy 'Preço pode estar defasado' com o relativo entre parênteses", () => {
    const r = getPriceFreshness(daysAgo(90), 60);
    expect(r.label).toMatch(/^Preço pode estar defasado \(há 90 dias\)$/);
  });

  it("rótulo de unknown é 'Data de atualização não informada'", () => {
    expect(getPriceFreshness(null, 60).label).toBe(
      "Data de atualização não informada",
    );
  });

  it("rótulo de data inválida é 'Data de atualização inválida'", () => {
    expect(getPriceFreshness("not-a-date", 60).label).toBe(
      "Data de atualização inválida",
    );
  });
});

describe("getPriceFreshness — tooltip pt-BR", () => {
  it("inclui data por extenso em pt-BR e a janela de validade", () => {
    const r = getPriceFreshness(daysAgo(10), 45);
    expect(r.tooltip).toMatch(/\d{1,2} de [a-zçãéíúô]+ de \d{4}/i);
    expect(r.tooltip).toContain("Validade configurada: 45 dias");
  });

  it("tooltip de stale orienta confirmar com o fornecedor", () => {
    const r = getPriceFreshness(daysAgo(120), 60);
    expect(r.tooltip.toLowerCase()).toContain("confirme o valor");
    expect(r.tooltip.toLowerCase()).toContain("fornecedor");
  });

  it("tooltip de aging orienta recomendar confirmação antes de fechar", () => {
    const r = getPriceFreshness(daysAgo(45), 60);
    expect(r.tooltip.toLowerCase()).toContain("recomendamos confirmar");
  });

  it("tooltip de fresh confirma que está dentro do prazo", () => {
    const r = getPriceFreshness(daysAgo(5), 60);
    expect(r.tooltip.toLowerCase()).toContain("dentro do prazo");
  });
});

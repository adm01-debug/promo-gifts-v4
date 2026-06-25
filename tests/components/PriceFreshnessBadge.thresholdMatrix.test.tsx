/**
 * Matriz parametrizada — `PriceFreshnessBadge` × `thresholdDays` por produto.
 *
 * O banco externo (SSOT) permite que cada produto carregue seu próprio
 * `price_freshness_threshold_days` (ex.: insumos voláteis 15d, têxteis
 * 30d, default catálogo 60d, kits estáveis 90d). Esta suíte trava a
 * regra de transição fresh → aging → stale para CADA threshold em CADA
 * variant do componente, garantindo que mudar o threshold de um
 * produto altera a UI de forma consistente em card, lista, tabela e PDP.
 *
 * Regra do util (`getPriceFreshness`):
 *   - days ≤ floor(threshold/2)        → fresh
 *   - floor(threshold/2) < days < threshold → aging
 *   - days >= threshold                  → stale
 *
 * Convenção de visibilidade:
 *   - icon-only / compact: só renderiza em aging|stale
 *   - inline / pdp: renderiza sempre
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceFreshnessBadge } from "@/components/products/PriceFreshnessBadge";
import { getPriceFreshness } from "@/utils/price-freshness";

const FIXED_NOW = new Date("2026-04-24T12:00:00.000Z").getTime();
const daysAgo = (d: number) =>
  new Date(FIXED_NOW - d * 86400000).toISOString();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

type Expected = "fresh" | "aging" | "stale";

/**
 * Casos parametrizados: para cada threshold, escolhemos `daysSince` que
 * caem deliberadamente nas três zonas (fresh, na borda fresh→aging,
 * aging, na borda aging→stale e stale).
 *
 * threshold | half | fresh | aging | stale
 *    15     |   7  |   3   |  10   |  20
 *    30     |  15  |   7   |  20   |  45
 *    60     |  30  |  10   |  45   |  90
 *    90     |  45  |  20   |  60   | 120
 */
const CASES: ReadonlyArray<{
  threshold: number;
  daysSince: number;
  expected: Expected;
}> = [
  // threshold 15 (insumos voláteis)
  { threshold: 15, daysSince: 3, expected: "fresh" },
  { threshold: 15, daysSince: 7, expected: "fresh" }, // borda inferior (=half)
  { threshold: 15, daysSince: 10, expected: "aging" },
  { threshold: 15, daysSince: 15, expected: "stale" }, // no threshold -> stale (BUG-008: days >= threshold)
  { threshold: 15, daysSince: 20, expected: "stale" },

  // threshold 30 (têxteis)
  { threshold: 30, daysSince: 7, expected: "fresh" },
  { threshold: 30, daysSince: 15, expected: "fresh" },
  { threshold: 30, daysSince: 20, expected: "aging" },
  { threshold: 30, daysSince: 30, expected: "stale" },
  { threshold: 30, daysSince: 45, expected: "stale" },

  // threshold 60 (default catálogo)
  { threshold: 60, daysSince: 10, expected: "fresh" },
  { threshold: 60, daysSince: 30, expected: "fresh" },
  { threshold: 60, daysSince: 45, expected: "aging" },
  { threshold: 60, daysSince: 60, expected: "stale" },
  { threshold: 60, daysSince: 90, expected: "stale" },

  // threshold 90 (kits estáveis)
  { threshold: 90, daysSince: 20, expected: "fresh" },
  { threshold: 90, daysSince: 45, expected: "fresh" },
  { threshold: 90, daysSince: 60, expected: "aging" },
  { threshold: 90, daysSince: 90, expected: "stale" },
  { threshold: 90, daysSince: 120, expected: "stale" },
];

const COMPACT_VARIANTS = ["icon-only", "compact"] as const;
const FULL_VARIANTS = ["inline", "pdp"] as const;

describe("PriceFreshnessBadge × thresholdDays — matriz parametrizada", () => {
  // ════════════════════════════════════════════════════════════════════
  // 1. CONTRATO DO UTIL — fonte da verdade da classificação
  // ════════════════════════════════════════════════════════════════════
  describe("getPriceFreshness (util) classifica corretamente cada (threshold × dias)", () => {
    it.each(CASES)(
      "threshold=$threshold, daysSince=$daysSince → status=$expected",
      ({ threshold, daysSince, expected }) => {
        const f = getPriceFreshness(daysAgo(daysSince), threshold);
        expect(f.status).toBe(expected);
        expect(f.thresholdDays).toBe(threshold);
        expect(f.daysSinceUpdate).toBe(daysSince);
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 2. VARIANTES COMPACTAS — só renderizam em aging|stale, em qualquer
  //    threshold. Esta é a regra crítica do catálogo: mudar o threshold
  //    de um produto deve alterar a visibilidade do badge.
  // ════════════════════════════════════════════════════════════════════
  describe.each(COMPACT_VARIANTS)(
    "variant=%s (catálogo: card / lista / tabela)",
    (variant) => {
      it.each(CASES)(
        "threshold=$threshold, daysSince=$daysSince ($expected) → visível ⇔ aging|stale",
        ({ threshold, daysSince, expected }) => {
          const { container } = render(
            <PriceFreshnessBadge
              priceUpdatedAt={daysAgo(daysSince)}
              thresholdDays={threshold}
              variant={variant}
            />,
          );
          const shouldRender = expected !== "fresh";
          if (shouldRender) {
            const badge = screen.getByRole("status");
            expect(badge).toBeInTheDocument();
            // Paleta amber padronizada para aging+stale.
            expect(badge.className).toMatch(/text-amber-700/);
            expect(badge.className).not.toMatch(
              /(text|bg|border)-(orange|red|yellow)-/,
            );
          } else {
            expect(container).toBeEmptyDOMElement();
          }
        },
      );
    },
  );

  // ════════════════════════════════════════════════════════════════════
  // 3. VARIANTES COMPLETAS — sempre renderizam, mas a paleta deve
  //    refletir o status calculado a partir do threshold do produto.
  // ════════════════════════════════════════════════════════════════════
  describe.each(FULL_VARIANTS)(
    "variant=%s (PDP / Quick View) — sempre visível, paleta segue status",
    (variant) => {
      it.each(CASES)(
        "threshold=$threshold, daysSince=$daysSince → renderiza com paleta de $expected",
        ({ threshold, daysSince, expected }) => {
          render(
            <PriceFreshnessBadge
              priceUpdatedAt={daysAgo(daysSince)}
              thresholdDays={threshold}
              variant={variant}
            />,
          );
          const badge = screen.getByRole("status");
          expect(badge).toBeInTheDocument();
          expect(badge.className).not.toMatch(
            /(text|bg|border)-(orange|red|yellow)-/,
          );

          if (expected === "fresh") {
            expect(badge.className).toMatch(/emerald-(50|200|400|500|700)/);
          } else {
            // aging e stale ambos usam família amber (intensidade varia
            // só no variant=pdp; aqui basta confirmar a família).
            expect(badge.className).toMatch(/amber-/);
          }

          if (expected === "stale") {
            expect(badge.textContent).toMatch(/preço pode estar defasado/i);
          }
        },
      );
    },
  );

  // ════════════════════════════════════════════════════════════════════
  // 4. INVARIANTE CROSS-COMPONENT — mesmo (daysSince) com thresholds
  //    diferentes deve produzir status DIFERENTE em todas as variantes,
  //    travando a regressão de "threshold ignorado" no nível visual.
  // ════════════════════════════════════════════════════════════════════
  describe("regra de threshold é honrada cross-variant (mesmo dias, threshold diferente → status diferente)", () => {
    const DAYS_SINCE = 40;
    // 40 dias é stale com threshold 30, aging com 60 e fresh com 90.
    const TRIO = [
      { threshold: 30, expected: "stale" as Expected },
      { threshold: 60, expected: "aging" as Expected },
      { threshold: 90, expected: "fresh" as Expected },
    ];

    it.each([...COMPACT_VARIANTS, ...FULL_VARIANTS])(
      "variant=%s respeita threshold do produto a 40 dias",
      (variant) => {
        for (const { threshold, expected } of TRIO) {
          const { unmount, container } = render(
            <PriceFreshnessBadge
              priceUpdatedAt={daysAgo(DAYS_SINCE)}
              thresholdDays={threshold}
              variant={variant}
            />,
          );
          const isCompact =
            variant === "icon-only" || variant === "compact";

          if (isCompact && expected === "fresh") {
            expect(
              container,
              `${variant}/threshold=${threshold} deveria estar oculto (fresh)`,
            ).toBeEmptyDOMElement();
          } else {
            const badge = screen.getByRole("status");
            if (expected === "fresh") {
              expect(badge.className).toMatch(/emerald-/);
            } else {
              expect(badge.className).toMatch(/amber-/);
            }
          }
          unmount();
        }
      },
    );
  });
});

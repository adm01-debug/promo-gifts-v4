/**
 * Matriz threshold × dias-desde-atualização × superfície.
 *
 * Garante que a regra do utilitário `getPriceFreshness` é respeitada por
 * TODAS as superfícies do catálogo (card, lista, tabela, quick view) ao
 * variar `thresholdDays` entre 30, 60 e 120 dias:
 *
 *   fresh  → days <= floor(threshold/2)         · emerald + CheckCircle2
 *   aging  → floor(threshold/2) < days <= thr   · amber   + Clock
 *   stale  → days > threshold                   · amber   + AlertTriangle
 *
 * Cobre 3 thresholds × 3 status × 4 superfícies = 36 cenários, mais
 * uma checagem cruzada provando que UM mesmo `daysSince` muda de status
 * apenas pela mudança do `thresholdDays`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceFreshnessBadge } from "@/components/products/PriceFreshnessBadge";

const FIXED_NOW = new Date("2026-04-24T12:00:00.000Z").getTime();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

const daysAgo = (n: number) =>
  new Date(FIXED_NOW - n * 86400000).toISOString();

type Status = "fresh" | "aging" | "stale";
type Surface = "card" | "list" | "table" | "quick";

const VARIANT_BY_SURFACE: Record<
  Surface,
  "inline" | "compact" | "icon-only"
> = {
  card: "icon-only",
  list: "compact",
  table: "icon-only",
  quick: "inline",
};

const COLOR_BY_STATUS: Record<Status, RegExp> = {
  fresh: /text-emerald-(600|700|400|500)/,
  aging: /text-amber-(600|700|300|400)/,
  stale: /text-amber-(600|700|300|400)/,
};

const ICON_BY_STATUS: Record<Status, RegExp> = {
  fresh: /lucide-circle-check(-big)?(?![\w-])|lucide-check-circle-?2/,
  aging: /lucide-clock/,
  stale: /lucide-triangle-alert|lucide-alert-triangle/,
};

const THRESHOLDS = [30, 60, 120] as const;
const SURFACES: Surface[] = ["card", "list", "table", "quick"];

/**
 * Para cada threshold, escolhe um `daysSince` representativo dentro de
 * cada faixa (com folga das fronteiras para evitar off-by-one):
 *   fresh: floor(thr/2) - 2
 *   aging: floor(thr/2) + 2          (ainda ≤ threshold)
 *   stale: threshold + 5
 */
function pickDays(threshold: number): Record<Status, number> {
  const half = Math.floor(threshold / 2);
  return {
    fresh: Math.max(0, half - 2),
    aging: half + 2,
    stale: threshold + 5,
  };
}

function renderBadge(
  surface: Surface,
  threshold: number,
  daysSince: number,
) {
  const variant = VARIANT_BY_SURFACE[surface];
  const alwaysShow = variant !== "inline"; // inline já renderiza sempre
  return render(
    <PriceFreshnessBadge
      priceUpdatedAt={daysAgo(daysSince)}
      thresholdDays={threshold}
      variant={variant}
      alwaysShow={alwaysShow}
    />,
  );
}

describe("PriceFreshnessBadge — thresholdDays variável (30/60/120) × hosts", () => {
  for (const threshold of THRESHOLDS) {
    const days = pickDays(threshold);

    describe(`thresholdDays=${threshold}`, () => {
      for (const surface of SURFACES) {
        const variant = VARIANT_BY_SURFACE[surface];

        it(`${surface} (${variant}) · fresh em ${days.fresh}d aplica verde + CheckCircle2`, () => {
          const { container } = renderBadge(surface, threshold, days.fresh);
          const badge = screen.getByRole("status");
          expect(badge.className).toMatch(COLOR_BY_STATUS.fresh);
          expect(container.querySelector("svg")?.getAttribute("class") ?? "")
            .toMatch(ICON_BY_STATUS.fresh);
        });

        it(`${surface} (${variant}) · aging em ${days.aging}d aplica âmbar + Clock`, () => {
          const { container } = renderBadge(surface, threshold, days.aging);
          const badge = screen.getByRole("status");
          expect(badge.className).toMatch(COLOR_BY_STATUS.aging);
          expect(container.querySelector("svg")?.getAttribute("class") ?? "")
            .toMatch(ICON_BY_STATUS.aging);
        });

        it(`${surface} (${variant}) · stale em ${days.stale}d aplica âmbar + AlertTriangle`, () => {
          const { container } = renderBadge(surface, threshold, days.stale);
          const badge = screen.getByRole("status");
          expect(badge.className).toMatch(COLOR_BY_STATUS.stale);
          expect(container.querySelector("svg")?.getAttribute("class") ?? "")
            .toMatch(ICON_BY_STATUS.stale);
        });
      }
    });
  }

  // Prova-pivot: UM mesmo `daysSince=45` muda de status apenas pela
  // mudança do threshold — sem regressões entre as superfícies.
  it("invariante cruzada: daysSince=45 muda de status conforme o threshold em todos os hosts", () => {
    const expectedByThreshold: Record<number, Status> = {
      30: "stale", // 45 > 30
      60: "aging", // 30 < 45 ≤ 60
      120: "fresh", // 45 ≤ 60
    };

    for (const surface of SURFACES) {
      for (const threshold of THRESHOLDS) {
        const expected = expectedByThreshold[threshold];
        const { container, unmount } = renderBadge(surface, threshold, 45);
        const badge = screen.getByRole("status");
        expect(
          badge.className,
          `surface=${surface} threshold=${threshold} esperado=${expected}`,
        ).toMatch(COLOR_BY_STATUS[expected]);
        expect(
          container.querySelector("svg")?.getAttribute("class") ?? "",
          `ícone surface=${surface} threshold=${threshold} esperado=${expected}`,
        ).toMatch(ICON_BY_STATUS[expected]);
        unmount();
      }
    }
  });
});

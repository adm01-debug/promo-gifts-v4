/**
 * Asserções por status validando classes de cor e ícone correspondente
 * em cada variante do catálogo:
 *  - card     → variant="icon-only"
 *  - lista    → variant="compact"
 *  - tabela   → variant="icon-only"
 *  - quick    → variant="inline"
 *
 * Paleta semântica do badge (ver STATUS_STYLES em PriceFreshnessBadge.tsx):
 *  - fresh   → verde   (emerald-700 / dark:emerald-400)  · CheckCircle2
 *  - aging   → âmbar   (amber-700  / dark:amber-300)     · Clock
 *  - stale   → âmbar   (amber-700  / dark:amber-300)     · AlertTriangle
 *  - unknown → cinza   (text-muted-foreground)           · HelpCircle
 *
 * Observação: não usamos vermelho — o pico de severidade (stale) é
 * amarelo+ícone de alerta para evitar fadiga visual no catálogo.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceFreshnessBadge } from "@/components/products/PriceFreshnessBadge";

const FIXED_NOW = new Date("2026-04-24T12:00:00.000Z").getTime();
const THRESHOLD = 60;

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

const daysAgo = (n: number) =>
  new Date(FIXED_NOW - n * 86400000).toISOString();

type Status = "fresh" | "aging" | "stale" | "unknown";
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

// daysSince usado para forçar cada status com threshold=60.
// fresh: ≤30 · aging: 31-60 · stale: >60 · unknown: priceUpdatedAt=null
const DAYS_BY_STATUS: Record<Exclude<Status, "unknown">, number> = {
  fresh: 5,
  aging: 45,
  stale: 90,
};

// Classes de cor esperadas por status (asserções resilientes a tweaks
// de tom — verificamos a família semântica, não o número exato).
const COLOR_FAMILY_BY_STATUS: Record<Status, RegExp> = {
  fresh: /text-emerald-(600|700|400|500)/,
  aging: /text-amber-(600|700|300|400)/,
  stale: /text-amber-(600|700|300|400)/,
  unknown: /text-muted-foreground/,
};

// Identificador do ícone Lucide via classe `lucide-*` que o pacote injeta.
const ICON_CLASS_BY_STATUS: Record<Status, RegExp> = {
  fresh: /lucide-circle-check(-big)?(?![\w-])|lucide-check-circle-?2/,
  aging: /lucide-clock/,
  stale: /lucide-triangle-alert|lucide-alert-triangle/,
  unknown: /lucide-circle-help|lucide-help-circle|lucide-circle-question-mark/,
};

function renderBadge(status: Status, surface: Surface) {
  const variant = VARIANT_BY_SURFACE[surface];
  const priceUpdatedAt =
    status === "unknown" ? null : daysAgo(DAYS_BY_STATUS[status]);

  // alwaysShow garante que `fresh`/`unknown` apareçam em variantes
  // silenciosas (icon-only/compact) — caso contrário não há o que
  // asseverar visualmente nesses estados.
  const alwaysShow = variant !== "inline";

  return render(
    <PriceFreshnessBadge
      priceUpdatedAt={priceUpdatedAt}
      thresholdDays={THRESHOLD}
      variant={variant}
      alwaysShow={alwaysShow}
    />,
  );
}

const SURFACES: Surface[] = ["card", "list", "table", "quick"];
const STATUSES: Status[] = ["fresh", "aging", "stale", "unknown"];

describe("PriceFreshnessBadge — cor e ícone por status × superfície", () => {
  for (const surface of SURFACES) {
    describe(`superfície: ${surface} (variant="${VARIANT_BY_SURFACE[surface]}")`, () => {
      for (const status of STATUSES) {
        it(`status=${status} aplica família de cor correta`, () => {
          renderBadge(status, surface);
          const badge = screen.getByRole("status");
          expect(badge.className).toMatch(COLOR_FAMILY_BY_STATUS[status]);
        });

        it(`status=${status} renderiza o ícone Lucide correspondente`, () => {
          const { container } = renderBadge(status, surface);
          const svg = container.querySelector("svg");
          expect(svg).not.toBeNull();
          expect(svg!.getAttribute("class") ?? "").toMatch(
            ICON_CLASS_BY_STATUS[status],
          );
        });
      }

      it("não usa classes vermelhas (stale também é amber, não destrutivo)", () => {
        const { container } = renderBadge("stale", surface);
        // O badge nunca deve aplicar text-red-* / text-destructive na cor
        // do ícone — a severidade é comunicada pelo ícone AlertTriangle,
        // não por escalada de cor.
        const html = container.innerHTML;
        expect(html).not.toMatch(/text-red-\d/);
        expect(html).not.toMatch(/text-destructive/);
      });
    });
  }

  it("invariante: aging e stale compartilham a mesma família âmbar em todas as superfícies", () => {
    for (const surface of SURFACES) {
      const { unmount: unmountAging } = renderBadge("aging", surface);
      const agingClass = screen.getByRole("status").className;
      expect(agingClass).toMatch(/amber-/);
      unmountAging();

      const { unmount: unmountStale } = renderBadge("stale", surface);
      const staleClass = screen.getByRole("status").className;
      expect(staleClass).toMatch(/amber-/);
      unmountStale();
    }
  });

  it("invariante: fresh é sempre verde (emerald) e unknown é sempre cinza (muted)", () => {
    for (const surface of SURFACES) {
      const { unmount: u1 } = renderBadge("fresh", surface);
      expect(screen.getByRole("status").className).toMatch(/emerald-/);
      u1();

      const { unmount: u2 } = renderBadge("unknown", surface);
      expect(screen.getByRole("status").className).toMatch(
        /text-muted-foreground/,
      );
      u2();
    }
  });
});

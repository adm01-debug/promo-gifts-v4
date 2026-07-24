/**
 * Contrato E2E: `intelligence.substitute_applied`
 *
 * Valida que `trackSubstituteApplied()` emite no buffer `window.__e2eAnalytics__`
 * com o schema esperado (nome, ts ISO-8601 e payload completo com axis,
 * substituteId, substituteName, days, culpritBefore).
 *
 * Estratégia: em contexto autenticado, resetamos o buffer e chamamos a função
 * do módulo via dynamic import dentro de `page.evaluate` (Vite serve ESM em
 * dev). Isso valida o contrato do payload real, sem depender de dataset Gold
 * populado para clicar em "Aplicar".
 */
import { expect } from "@playwright/test";

import { test } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";
import {
  readAnalyticsEvents,
  resetAnalyticsBuffer,
  type AnalyticsEvent,
} from "../helpers/analytics";

type Axis = "categoryId" | "supplierId" | "productId";

interface Fixture {
  axis: Axis;
  substituteId: string;
  substituteName: string | null;
  days: number;
  culpritBefore: Axis | "window" | "intersection" | null;
}

const FIXTURES: Fixture[] = [
  {
    axis: "categoryId",
    substituteId: "cat-42",
    substituteName: "Canetas ecológicas",
    days: 30,
    culpritBefore: "supplierId",
  },
  {
    axis: "supplierId",
    substituteId: "sup-7",
    substituteName: "Fornecedor Alfa",
    days: 90,
    culpritBefore: "categoryId",
  },
  {
    axis: "productId",
    substituteId: "prod-123",
    substituteName: null,
    days: 7,
    culpritBefore: "window",
  },
];

test.describe("analytics · intelligence.substitute_applied", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/inteligencia-comercial");
    await resetAnalyticsBuffer(page);
  });

  test("payload segue o contrato SubstituteAppliedPayload no buffer E2E", async ({
    page,
  }) => {
    for (const fx of FIXTURES) {
      await resetAnalyticsBuffer(page);

      await page.evaluate(async (payload) => {
        const mod = await import(
          /* @vite-ignore */ "/src/lib/analytics/intelligenceAnalytics.ts"
        );
        mod.trackSubstituteApplied(payload);
      }, fx);

      const events = await readAnalyticsEvents(page);
      expect(events, `1 evento por chamada (axis=${fx.axis})`).toHaveLength(1);

      const evt = events[0] as AnalyticsEvent;
      expect(evt.name).toBe("intelligence.substitute_applied");
      // ts deve ser ISO-8601 parseável.
      expect(Number.isNaN(Date.parse(evt.ts))).toBe(false);

      expect(evt.payload).toEqual({
        axis: fx.axis,
        substituteId: fx.substituteId,
        substituteName: fx.substituteName,
        days: fx.days,
        culpritBefore: fx.culpritBefore,
      });
    }
  });

  test("buffer preserva ordem de múltiplas chamadas consecutivas", async ({
    page,
  }) => {
    await page.evaluate(async (fixtures) => {
      const mod = await import(
        /* @vite-ignore */ "/src/lib/analytics/intelligenceAnalytics.ts"
      );
      for (const fx of fixtures) mod.trackSubstituteApplied(fx);
    }, FIXTURES);

    const events = await readAnalyticsEvents(page);
    expect(events).toHaveLength(FIXTURES.length);
    events.forEach((evt, i) => {
      expect(evt.name).toBe("intelligence.substitute_applied");
      expect((evt.payload as { axis: string }).axis).toBe(FIXTURES[i]!.axis);
      expect((evt.payload as { substituteId: string }).substituteId).toBe(
        FIXTURES[i]!.substituteId,
      );
    });
  });

  test("dispara CustomEvent 'lovable:analytics' com o mesmo payload", async ({
    page,
  }) => {
    const captured = await page.evaluate(async (fx) => {
      const detail = await new Promise<unknown>((resolve) => {
        const handler = (e: Event) => {
          window.removeEventListener("lovable:analytics", handler);
          resolve((e as CustomEvent).detail);
        };
        window.addEventListener("lovable:analytics", handler);
        void import(
          /* @vite-ignore */ "/src/lib/analytics/intelligenceAnalytics.ts"
        ).then((mod) => mod.trackSubstituteApplied(fx));
      });
      return detail;
    }, FIXTURES[0]);

    expect(captured).toMatchObject({
      name: "intelligence.substitute_applied",
      payload: {
        axis: FIXTURES[0]!.axis,
        substituteId: FIXTURES[0]!.substituteId,
        substituteName: FIXTURES[0]!.substituteName,
        days: FIXTURES[0]!.days,
        culpritBefore: FIXTURES[0]!.culpritBefore,
      },
    });
  });
});

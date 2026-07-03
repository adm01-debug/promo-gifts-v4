/**
 * E2E — Regressão visual do reflow do ConfigurationPanelV6 / LocationPanel.
 *
 * Roda em MOBILE (390x844) e DESKTOP (1440x900) para validar que o reflow
 * é consistente nos dois breakpoints.
 *
 * Estabilização de frame:
 *   - Aguardamos `requestAnimationFrame` duas vezes + `waitForFunction` sobre
 *     `getBoundingClientRect().height` estabilizada entre 2 rAFs (garante que
 *     a transição de 300ms terminou antes do screenshot).
 *
 * Comandos:
 *   npm run e2e:collapse             # roda os testes (mobile + desktop)
 *   npm run e2e:collapse:update      # semeia/atualiza baselines (usar 1x)
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { TID } from "../fixtures/selectors";
import type { Locator, Page } from "@playwright/test";

const TOGGLE = TID("customization-collapse-toggle");
const SHELL = '[data-testid="customization-config-shell"]';

// Instrumentação para depuração de falhas: trace, vídeo e screenshot completos
// em qualquer falha (inclusive diff visual). Artifacts são publicados pelo
// workflow `.github/workflows/e2e-customization-collapse.yml`.
test.use({
  trace: "retain-on-failure",
  video: "retain-on-failure",
  screenshot: "only-on-failure",
});

const VIEWPORTS = [
  { label: "mobile", width: 390, height: 844 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "desktop", width: 1440, height: 900 },
] as const;

/**
 * Aguarda a UI parar de animar: 2× rAF + altura estável entre 2 medições
 * consecutivas. Evita capturar frame intermediário da transição de 300ms.
 */
async function waitForStableHeight(page: Page, locator: Locator): Promise<number> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const handle = await locator.elementHandle();
  if (!handle) throw new Error("shell handle indisponível");
  await page.waitForFunction(
    (el) =>
      new Promise<boolean>((resolve) => {
        const h1 = (el as HTMLElement).getBoundingClientRect().height;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const h2 = (el as HTMLElement).getBoundingClientRect().height;
            resolve(Math.abs(h1 - h2) < 0.5);
          }),
        );
      }),
    handle,
    { timeout: 2_000 },
  );
  const box = await locator.boundingBox();
  return box?.height ?? 0;
}

for (const vp of VIEWPORTS) {
  test.describe(`ConfigurationPanelV6 — reflow visual (${vp.label})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test.beforeEach(() => requireAuth());

    test(`colapsar reduz altura e não deixa gap residual [${vp.label}]`, async ({ page }) => {
      await gotoAndSettle(page, "/orcamentos/novo");

      const toggle = page.locator(TOGGLE).first();
      if (!(await toggle.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip(true, "Painel de personalização indisponível neste ambiente.");
        return;
      }

      const shell = page.locator(SHELL).first();
      await expect(shell).toBeVisible();

      if ((await toggle.getAttribute("aria-expanded")) === "false") {
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
      }

      const expandedHeight = await waitForStableHeight(page, shell);
      await expect(shell).toHaveScreenshot(`location-panel-expanded-${vp.label}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");

      const collapsedHeight = await waitForStableHeight(page, shell);

      await expect(shell).not.toHaveClass(/min-h-\[260px\]/);
      expect(collapsedHeight).toBeLessThan(expandedHeight);

      await expect(shell).toHaveScreenshot(`location-panel-collapsed-${vp.label}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });
    });
  });
}

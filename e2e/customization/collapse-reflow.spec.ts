/**
 * E2E — Regressão visual do reflow do ConfigurationPanelV6 / LocationPanel.
 *
 * Objetivo: garantir que o card de gravação encolhe suavemente e o conteúdo
 * abaixo (TOTAL PERSONALIZAÇÃO etc.) sobe/desce sem "gap" residual.
 *
 * Estratégia:
 *   1. Captura screenshot do wrapper de personalização EXPANDIDO.
 *   2. Colapsa e aguarda a transição (300ms + folga).
 *   3. Captura screenshot COLAPSADO.
 *   4. Compara altura (colapsado < expandido) e valida snapshots visuais.
 *   5. Garante que o shell não retém `min-h-[260px]` no estado colapsado.
 *
 * Para atualizar baselines locais:
 *   npx playwright test e2e/customization/collapse-reflow.spec.ts \
 *     --project=chromium-authed --update-snapshots
 *
 * No CI use o workflow "E2E — Customization Collapse (LocationPanel)"
 * com o input `update_snapshots=true` (workflow_dispatch).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { TID } from "../fixtures/selectors";

const TOGGLE = TID("customization-collapse-toggle");
const SHELL = '[data-testid="customization-config-shell"]';

test.describe("ConfigurationPanelV6 — reflow visual", () => {
  test.beforeEach(() => requireAuth());

  test("colapsar reduz altura e não deixa gap residual (antes/depois)", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    const toggle = page.locator(TOGGLE).first();
    if (!(await toggle.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Painel de personalização indisponível neste ambiente.");
      return;
    }

    const shell = page.locator(SHELL).first();
    await expect(shell).toBeVisible();

    // Garante estado inicial expandido (idempotente).
    if ((await toggle.getAttribute("aria-expanded")) === "false") {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    }

    // Estabiliza layout antes da baseline.
    await page.waitForTimeout(400);
    const expandedBox = await shell.boundingBox();
    expect(expandedBox).not.toBeNull();

    await expect(shell).toHaveScreenshot("location-panel-expanded.png", {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    });

    // Colapsa e aguarda transição de 300ms + gap-{0|4} + min-height.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.waitForTimeout(500);

    // Regra crítica: o shell não pode reter min-h-[260px] quando colapsado
    // (senão o conteúdo abaixo não sobe — bug corrigido em LocationPanel.tsx).
    await expect(shell).not.toHaveClass(/min-h-\[260px\]/);

    const collapsedBox = await shell.boundingBox();
    expect(collapsedBox).not.toBeNull();
    expect(collapsedBox!.height).toBeLessThan(expandedBox!.height);

    await expect(shell).toHaveScreenshot("location-panel-collapsed.png", {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    });
  });
});

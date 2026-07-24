/**
 * E2E — Super Filtro · alinhamento dos botões "Selecionar" e "Layout".
 *
 * Valida que o grupo de ações (data-testid="superfiltro-toolbar-actions")
 * está ancorado à borda direita da toolbar (via `ml-auto`) e separado do
 * grupo de filtros/ordenação por um divisor vertical — em mobile e desktop.
 *
 * Inclui snapshot visual determinístico (animations: disabled) e asserções
 * de a11y (role=group, aria-label, focus-visible).
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/filtros';
const ACTIONS = '[data-testid="superfiltro-toolbar-actions"]';
const SELECT_BTN = '[aria-label="Ativar modo de seleção em massa"], [aria-label="Cancelar seleção"]';
const LAYOUT_BTN = '[data-testid="layout-popover-trigger"]';

test.describe('Super Filtro · alinhamento direito de Selecionar/Layout', () => {
  test.beforeEach(() => requireAuth());

  for (const vp of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1280, height: 1800 },
  ] as const) {
    test(`[${vp.name}] ações ancoradas à direita + a11y`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, ROUTE);

      const actions = page.locator(ACTIONS).first();
      await expect(actions).toBeVisible();

      // A11y: role + aria-label no bloco
      await expect(actions).toHaveAttribute('role', 'group');
      await expect(actions).toHaveAttribute('aria-label', /Ações da listagem/i);

      // Alinhamento: borda direita das ações ≈ borda direita do parent (margin 24px tolerância)
      const actionsBox = await actions.boundingBox();
      const parentBox = await actions.evaluateHandle((el) => el.parentElement!).then((h) =>
        h.asElement()!.boundingBox(),
      );
      expect(actionsBox && parentBox).toBeTruthy();
      if (actionsBox && parentBox) {
        const gap = parentBox.x + parentBox.width - (actionsBox.x + actionsBox.width);
        expect(gap).toBeLessThanOrEqual(24);
      }

      // Divisor vertical presente em qualquer breakpoint
      const borderLeft = await actions.evaluate(
        (el) => getComputedStyle(el).borderLeftWidth,
      );
      expect(parseFloat(borderLeft)).toBeGreaterThan(0);

      // Foco visível ao tabular para os botões
      const selectBtn = page.locator(SELECT_BTN).first();
      const layoutBtn = page.locator(LAYOUT_BTN).first();
      await selectBtn.focus();
      await expect(selectBtn).toBeFocused();
      const selectOutline = await selectBtn.evaluate(
        (el) => getComputedStyle(el).boxShadow + ' ' + getComputedStyle(el).outlineStyle,
      );
      expect(selectOutline.length).toBeGreaterThan(0);

      await layoutBtn.focus();
      await expect(layoutBtn).toBeFocused();

      // Snapshot visual determinístico do bloco de ações
      await expect(actions).toHaveScreenshot(
        `superfiltro-actions-${vp.name}.png`,
        { animations: 'disabled', maxDiffPixelRatio: 0.02 },
      );
    });
  }
});

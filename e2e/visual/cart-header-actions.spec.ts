/**
 * Visual regression + a11y do header do carrinho ativo em /carrinhos.
 *
 * Cobre:
 *  - Bloco "Prazo p/ envio" em 2 linhas (label + input+badge)
 *  - Grupo de ações (Status | ⋯ | Layout) ancorado à direita
 *  - 3 viewports: mobile (375), tablet (820), desktop (1440)
 *
 * Snapshots vivem em ./cart-header-actions.spec.ts-snapshots/
 * Atualizar com: `playwright test e2e/visual/cart-header-actions.spec.ts --update-snapshots`
 *
 * A11y: axe-core scanned no header inteiro; falha em violações WCAG AA (color-contrast,
 * button-name, label, aria-*).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, requireAuth, test } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import { Sel } from '../fixtures/selectors';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const HEADER = '[data-testid="active-cart-header"]';
const BLOCK = '[data-testid="cart-shipping-deadline-block"]';
const ACTIONS = '[data-testid="cart-header-actions"]';

test.describe('CartHeader — visual regression + a11y (Prazo p/ envio + ações)', () => {
  test.beforeEach(() => requireAuth());

  for (const vp of VIEWPORTS) {
    test(`@${vp.name}: layout do header não quebra`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/carrinhos');

      // Precisa existir pelo menos um carrinho ativo pra o header montar
      const rows = page.locator(Sel.carts.rows);
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'sem carrinhos — não há header ativo pra testar');

      // Abre o primeiro carrinho
      await rows.first().click();
      const header = page.locator(HEADER);
      await expect(header).toBeVisible({ timeout: 10_000 });

      // Bloco e grupo devem existir e estar visíveis
      await expect(page.locator(BLOCK)).toBeVisible();
      await expect(page.locator(ACTIONS)).toBeVisible();

      // Screenshot do header inteiro
      await expect(header).toHaveScreenshot(`cart-header-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
      });

      // Screenshot isolado do grupo de ações (regressão fina de ancoragem)
      await expect(page.locator(ACTIONS)).toHaveScreenshot(
        `cart-header-actions-${vp.name}.png`,
        { maxDiffPixelRatio: 0.02 },
      );
    });

    test(`@${vp.name}: bloco "Prazo p/ envio" mantém 2 linhas estruturais`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/carrinhos');
      const rows = page.locator(Sel.carts.rows);
      test.skip((await rows.count()) === 0, 'sem carrinhos');
      await rows.first().click();

      const block = page.locator(BLOCK);
      await expect(block).toBeVisible();

      const label = block.locator('label[for="cart-shipping-deadline"]');
      const input = block.locator('[data-testid="cart-shipping-deadline-input"]');
      await expect(label).toBeVisible();
      await expect(input).toBeVisible();

      // Label DEVE estar em uma linha acima do input (2 linhas visuais)
      const labelBox = await label.boundingBox();
      const inputBox = await input.boundingBox();
      expect(labelBox && inputBox).toBeTruthy();
      expect(inputBox!.y).toBeGreaterThan(labelBox!.y + labelBox!.height - 4);
    });

    test(`@${vp.name}: grupo de ações ancora à direita da viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/carrinhos');
      const rows = page.locator(Sel.carts.rows);
      test.skip((await rows.count()) === 0, 'sem carrinhos');
      await rows.first().click();

      const header = page.locator(HEADER);
      const actions = page.locator(ACTIONS);
      const headerBox = await header.boundingBox();
      const actionsBox = await actions.boundingBox();
      expect(headerBox && actionsBox).toBeTruthy();

      // A borda direita das ações deve estar próxima da borda direita do header.
      const rightGap =
        headerBox!.x + headerBox!.width - (actionsBox!.x + actionsBox!.width);
      expect(rightGap).toBeLessThanOrEqual(24);
    });

    test(`@${vp.name}: axe-core sem violações críticas no header`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/carrinhos');
      const rows = page.locator(Sel.carts.rows);
      test.skip((await rows.count()) === 0, 'sem carrinhos');
      await rows.first().click();
      await expect(page.locator(HEADER)).toBeVisible();

      const results = await new AxeBuilder({ page })
        .include(HEADER)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['region']) // header inline não é landmark próprio
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(
        critical,
        `Violações a11y: ${critical.map((v) => v.id).join(', ')}`,
      ).toEqual([]);
    });
  }
});

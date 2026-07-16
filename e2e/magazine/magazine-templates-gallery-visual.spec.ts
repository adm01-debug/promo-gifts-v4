/**
 * Magazine Templates Gallery — Regressão Visual.
 *
 * Captura screenshot de cada card do template (miniatura + meta) na galeria
 * `/magazine/templates` e compara com baseline. Um refactor que altere de
 * forma imprevista o preview de qualquer template quebra o gate.
 *
 * Estratégia:
 *   - Prefetch on-focus/hover está ligado nos cards, mas para o snapshot
 *     determinístico forçamos a montagem via scroll até o card + espera de
 *     rede idle (o template é 100% React, sem imagens externas).
 *   - `maxDiffPixelRatio` conservador (2%) — miniaturas em `transform: scale`
 *     têm pequenas variações de antialiasing entre runs.
 *   - Executa apenas em `chromium` (viewport determinístico) para não
 *     explodir a matriz de snapshots.
 */
import { test, expect, requireAuth } from './fixtures/test-base';
import { gotoAndSettle } from './helpers/nav';
import { waitForTestIdVisible } from './helpers/waits';
import { Sel } from './fixtures/selectors';

const KNOWN_IDS = [
  'editorial-vogue',
  'editorial-drop-cap',
  'catalog-grid',
  'corporate-clean',
] as const;

test.describe('Magazine Templates Gallery — Visual @visual', () => {
  test.beforeEach(() => requireAuth());

  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, '/magazine/templates');
    await waitForTestIdVisible(page, 'page-title-magazine-templates');
    // Garante que o grid está pintado antes de fotografar.
    await page.locator(Sel.magazineTemplates.cards).first().waitFor({ state: 'visible' });
  });

  for (const id of KNOWN_IDS) {
    test(`card do template "${id}" mantém baseline visual`, async ({ page }) => {
      const card = page.locator(Sel.magazineTemplates.card(id));

      // Scroll até visibilidade e força prefetch (hover) para montar o template real.
      await card.scrollIntoViewIfNeeded();
      await card.hover();

      // Aguarda o botão de "usar" (indicador estrutural de card pronto).
      await expect(card.locator(Sel.magazineTemplates.use(id))).toBeVisible();

      await expect(card).toHaveScreenshot(`template-card-${id}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  }
});

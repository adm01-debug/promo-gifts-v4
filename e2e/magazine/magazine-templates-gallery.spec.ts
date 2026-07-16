/**
 * E2E — Galeria de Templates de Revista (/magazine/templates)
 *
 * Cobertura (Ondas 1–12 do hardening 10/10):
 *   1. Renderiza os 12 cards do TEMPLATE_REGISTRY.
 *   2. Filtro por família reduz o conjunto (Todos → Editorial).
 *   3. Botão "Usar este template" sem `returnTo` navega para /magazine.
 *   4. `?returnTo=/magazine/<id>` válido + clique em "Usar" navega
 *      para o editor com `?applyTemplate=<id>`.
 *   5. **Segurança:** `?returnTo=//evil.com/magazine/x` é rejeitado —
 *      o botão volta ao fluxo default (/magazine).
 *   6. Toggle de favorito persiste no localStorage e o card com favorito
 *      aparece PRIMEIRO na próxima navegação.
 *
 * Estratégia: rota autenticada — usa `loginAs(page)` do SSOT.
 */
import { test, expect } from '@playwright/test';

import { Sel } from '../fixtures/selectors';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { waitForTestIdVisible } from '../helpers/waits';

const GALLERY_PATH = '/magazine/templates';
const SAMPLE_MAG_ID = 'e2e-mag-templates-target';
// Um dos ids conhecidos do TEMPLATE_REGISTRY (editorial-vogue existe em v1).
const KNOWN_TEMPLATE_ID = 'editorial-vogue';

test.describe('Galeria de Templates de Revista @gallery', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('renderiza os 12 cards do registry', async ({ page }) => {
    await gotoAndSettle(page, GALLERY_PATH);
    await waitForTestId(page, 'page-title-magazine-templates');
    const cards = page.locator(Sel.magazineTemplates.cards);
    await expect(cards).toHaveCount(12);
  });

  test('filtro por família reduz o conjunto', async ({ page }) => {
    await gotoAndSettle(page, GALLERY_PATH);
    await waitForTestId(page, 'page-title-magazine-templates');

    const totalAll = await page.locator(Sel.magazineTemplates.cards).count();
    expect(totalAll).toBe(12);

    await page.locator(Sel.magazineTemplates.familyTab('editorial')).click();
    const editorialCount = await page.locator(Sel.magazineTemplates.cards).count();
    expect(editorialCount).toBeGreaterThan(0);
    expect(editorialCount).toBeLessThan(totalAll);
  });

  test('sem returnTo → "Criar revista" navega para /magazine', async ({ page }) => {
    await gotoAndSettle(page, GALLERY_PATH);
    await waitForTestId(page, 'page-title-magazine-templates');
    await page.locator(Sel.magazineTemplates.use(KNOWN_TEMPLATE_ID)).first().click();
    await expect(page).toHaveURL(/\/magazine(\?|$)/, { timeout: 10_000 });
  });

  test('returnTo válido → "Usar" volta ao editor com ?applyTemplate', async ({ page }) => {
    const returnTo = `/magazine/${SAMPLE_MAG_ID}`;
    await gotoAndSettle(page, `${GALLERY_PATH}?returnTo=${encodeURIComponent(returnTo)}`);
    await waitForTestId(page, 'page-title-magazine-templates');
    await page.locator(Sel.magazineTemplates.use(KNOWN_TEMPLATE_ID)).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/magazine/${SAMPLE_MAG_ID}\\?applyTemplate=${KNOWN_TEMPLATE_ID}`),
      { timeout: 10_000 },
    );
  });

  test('segurança: returnTo malicioso (//evil.com) é rejeitado', async ({ page }) => {
    await gotoAndSettle(page, `${GALLERY_PATH}?returnTo=%2F%2Fevil.com%2Fmagazine%2Fabc`);
    await waitForTestId(page, 'page-title-magazine-templates');
    await page.locator(Sel.magazineTemplates.use(KNOWN_TEMPLATE_ID)).first().click();
    // Cai no fluxo default — NUNCA para evil.com.
    await expect(page).toHaveURL(/\/magazine(\?|$)/, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/evil\.com/);
  });

  test('favorito persiste em localStorage e reordena a galeria', async ({ page }) => {
    await gotoAndSettle(page, GALLERY_PATH);
    await waitForTestId(page, 'page-title-magazine-templates');
    await page.locator(Sel.magazineTemplates.favorite(KNOWN_TEMPLATE_ID)).click();

    const stored = await page.evaluate(() =>
      window.localStorage.getItem('magazine:favorite-template'),
    );
    expect(stored).toBe(KNOWN_TEMPLATE_ID);

    // Recarrega — favorito deve ser o primeiro card visível.
    await gotoAndSettle(page, GALLERY_PATH);
    await waitForTestId(page, 'page-title-magazine-templates');
    const firstCard = page.locator(Sel.magazineTemplates.cards).first();
    await expect(firstCard).toHaveAttribute(
      'data-testid',
      `template-card-${KNOWN_TEMPLATE_ID}`,
    );

    // Limpa para não vazar entre execuções.
    await page.evaluate(() => window.localStorage.removeItem('magazine:favorite-template'));
  });
});

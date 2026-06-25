/**
 * E2E — unicidade do gatilho de export PDF no desktop.
 *
 * Garante que:
 *  1. Existe exatamente UM `data-testid="pdf-preview-trigger"` no desktop.
 *  2. NÃO existe `data-testid="export-pdf-button"` ANTES de abrir o dialog
 *     (evita regressão da duplicação que afetava o spec quote-pdf).
 *  3. Após abrir o dialog, existe exatamente UM `export-pdf-button`
 *     (o confirm) — esse é o único acionável para baixar o PDF.
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import {
  gotoQuoteScenario,
} from './_helpers/quote-scenarios';

test.describe('PDF export · unicidade do gatilho (desktop)', () => {
  test.skip(
    ({ page: _page }, testInfo) => testInfo.project.name !== 'chromium-authed',
    'Requer auth real.',
  );
  test.beforeEach(() => requireAuth());

  test('apenas 1 `pdf-preview-trigger` e 1 `export-pdf-button` após abrir o dialog', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const ok = await gotoQuoteScenario(page, 'enviada');
    if (!ok) test.skip(true, 'Sem orçamento enviado no ambiente.');

    // (1) trigger único no desktop.
    const trigger = page.getByTestId('pdf-preview-trigger');
    await expect(trigger).toHaveCount(1);

    // (2) antes de abrir o dialog, não deve haver botões `export-pdf-button`
    //     visíveis no desktop (mobile action bar fica escondido por CSS).
    const visibleBefore = await page
      .getByTestId('export-pdf-button')
      .filter({ has: page.locator(':visible') })
      .count();
    expect(visibleBefore).toBe(0);

    // (3) abre dialog e confirma que existe exatamente 1 confirm acionável.
    await trigger.click();
    const confirm = page.getByTestId('export-pdf-button');
    await expect(confirm).toHaveCount(1, { timeout: 10_000 });
    await expect(confirm).toBeVisible();
    await expect(confirm).toBeEnabled();
  });
});

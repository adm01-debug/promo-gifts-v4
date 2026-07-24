/**
 * QuoteItemDetailSheet — a11y axe-core, foco/Tab e limites de layout.
 *
 * Roda sobre `/__visual/quote-view-order` (harness sem auth/seed) que
 * monta o sheet via `<QuoteItemDetailSheet>` em uma linha de item demo.
 *
 * Cobertura:
 *  1. axe WCAG 2.1 AA na página inteira (QuoteView) e dentro do sheet aberto.
 *  2. Foco inicial cai dentro do SheetContent ao abrir; volta ao trigger ao
 *     fechar (Escape). Tab avança APENAS entre elementos focáveis do sheet
 *     (foco fica preso — comportamento esperado do Radix Sheet).
 *  3. Em 320/375/768, antes e depois de abrir o sheet, não há overflow
 *     horizontal de página nem do próprio SheetContent.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
] as const;

async function openHarness(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
  await expect(page.getByTestId('quote-item-detail-trigger')).toBeVisible();
}

async function openSheet(page: Page) {
  await page.getByTestId('quote-item-detail-trigger').click();
  // Radix Sheet usa role="dialog"
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('axe-core WCAG 2.1 AA — QuoteView harness (fechado)', async ({ page }) => {
  await openHarness(page);
  const results = await new AxeBuilder({ page })
    .include('[data-testid="quote-view-order-harness"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('axe-core WCAG 2.1 AA — QuoteItemDetailSheet (aberto)', async ({ page }) => {
  await openHarness(page);
  await openSheet(page);
  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('foco inicial no sheet e retorno ao trigger após Escape', async ({ page }) => {
  await openHarness(page);
  const trigger = page.getByTestId('quote-item-detail-trigger');
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Foco inicial deve estar DENTRO do dialog (Radix gerencia auto-focus).
  const focusInsideDialog = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return !!dlg && !!document.activeElement && dlg.contains(document.activeElement);
  });
  expect(focusInsideDialog, 'foco inicial deve estar dentro do SheetContent').toBe(true);

  // Tab avança e permanece dentro do dialog (focus trap do Radix).
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    const stillInside = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return !!dlg && !!document.activeElement && dlg.contains(document.activeElement);
    });
    expect(stillInside, `Tab #${i + 1} deve manter foco dentro do dialog`).toBe(true);
  }

  // Escape fecha o sheet e devolve foco ao trigger.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const vp of VIEWPORTS) {
  test(`sem overflow horizontal @ ${vp.name}px — fechado e com sheet aberto`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openHarness(page);

    const measure = async () =>
      page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));

    const closed = await measure();
    expect(
      closed.scrollW,
      `[fechado @${vp.name}] scrollWidth=${closed.scrollW} > clientWidth=${closed.clientW}`,
    ).toBeLessThanOrEqual(closed.clientW + 1);

    const dialog = await openSheet(page);
    const opened = await measure();
    expect(
      opened.scrollW,
      `[sheet aberto @${vp.name}] scrollWidth=${opened.scrollW} > clientWidth=${opened.clientW}`,
    ).toBeLessThanOrEqual(opened.clientW + 1);

    // SheetContent não pode ultrapassar a largura do viewport.
    const sheetBox = await dialog.boundingBox();
    expect(sheetBox, 'sheet bounding box').not.toBeNull();
    if (sheetBox) {
      expect(
        sheetBox.width,
        `[sheet @${vp.name}] largura ${sheetBox.width} > viewport ${vp.width}`,
      ).toBeLessThanOrEqual(vp.width + 1);
    }
  });
}

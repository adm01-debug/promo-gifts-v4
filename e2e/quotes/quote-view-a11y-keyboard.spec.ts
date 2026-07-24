/**
 * QuoteViewPage · a11y, navegação por teclado e responsividade.
 *
 * Cobre, sobre o harness `/__visual/quote-view-order` (sem auth/seed):
 *   1. axe-core WCAG 2.1 AA em light e dark (contraste real do tema).
 *   2. Tab order — Voltar → Preview → Mais opções (sem alvos inalcançáveis).
 *   3. focus-visible — outline/ring detectável em todos os botões interativos.
 *   4. Responsividade — viewports 320/375/768 sem overflow horizontal de página
 *      (a tabela usa scroll interno via `overflow-x-auto`).
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

async function go(page: Page, theme: 'light' | 'dark' = 'light') {
  await gotoAndSettle(page, theme === 'dark' ? `${ROUTE}?theme=dark` : ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
  await expect(page.getByTestId('page-title-quote-view')).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  test(`axe-core WCAG 2.1 AA — harness (${theme})`, async ({ page }) => {
    await go(page, theme);
    const results = await new AxeBuilder({ page })
      .include('[data-testid="quote-view-order-harness"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations,
      `Violações a11y (${theme}): ${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });
}

test('tab order — Voltar → Preview → Mais opções', async ({ page }) => {
  await go(page);
  // Foca o primeiro botão interativo e tabula adiante.
  await page.getByRole('button', { name: 'Voltar' }).focus();
  await expect(page.getByRole('button', { name: 'Voltar' })).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('pdf-preview-trigger')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('quote-actions-trigger')).toBeFocused();

  // Abre o menu via teclado e confirma que o item "Excluir" recebe foco
  // pelas setas (alvo alcançável sem mouse).
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('quote-actions-menu')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('quote-actions-delete')).toBeFocused();
});

test('focus-visible — botões expõem indicador detectável', async ({ page }) => {
  await go(page);
  const targets = ['pdf-preview-trigger', 'quote-actions-trigger'] as const;
  for (const id of targets) {
    const el = page.getByTestId(id);
    await el.focus();
    const indicator = await el.evaluate((node) => {
      const cs = window.getComputedStyle(node as HTMLElement);
      const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const hasRing = cs.boxShadow !== 'none' && cs.boxShadow.length > 0;
      return { hasOutline, hasRing };
    });
    expect(
      indicator.hasOutline || indicator.hasRing,
      `Sem foco visível em ${id}: ${JSON.stringify(indicator)}`,
    ).toBe(true);
  }
});

for (const width of [320, 375, 768] as const) {
  test(`responsividade — viewport ${width}px sem overflow de página`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await go(page);
    const overflow = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
    }));
    // Tolerância de 1px para subpixel rounding.
    expect(
      overflow.docW,
      `overflow horizontal: ${overflow.docW} > ${overflow.winW}`,
    ).toBeLessThanOrEqual(overflow.winW + 1);
  });
}

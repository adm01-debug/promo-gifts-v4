/**
 * QuoteBuilder "+ Produto" (botão do Resumo) — a11y, abertura do
 * QuoteBuilderProductSearch, estado disabled/loading e interatividade
 * com conteúdo longo nos viewports 320/375/768/1024/1440.
 *
 * Usa o harness `/__visual/quote-add-product-button` que replica
 * exatamente o markup do botão real (mesmo data-testid + a11y).
 */
import { test, expect } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-add-product-button';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1440', width: 1440, height: 1000 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`+ Produto @ ${vp.name}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test('a11y: aria-label, title e ícone decorativo', async ({ page }) => {
      await gotoAndSettle(page, ROUTE);
      const btn = page.getByTestId('quote-add-product-button-summary');
      await expect(btn).toBeVisible();
      await expect(btn).toBeEnabled();
      await expect(btn).toHaveAttribute(
        'aria-label',
        'Adicionar novo produto ao orçamento',
      );
      await expect(btn).toHaveAttribute(
        'title',
        'Adicionar novo produto ao orçamento',
      );
      const iconAriaHidden = await btn.locator('svg').first().getAttribute('aria-hidden');
      expect(iconAriaHidden).toBe('true');
    });

    test('clique abre QuoteBuilderProductSearch e fica interativo com conteúdo longo', async ({
      page,
    }) => {
      await gotoAndSettle(page, `${ROUTE}?longContent=1`);
      await expect(page.getByTestId('product-search-open-state')).toHaveAttribute(
        'data-open',
        '0',
      );

      await page.getByTestId('quote-add-product-button-summary').click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByTestId('product-search-open-state')).toHaveAttribute(
        'data-open',
        '1',
      );

      // Dialog cabe no viewport — sem overflow horizontal.
      const dlgBox = await dialog.boundingBox();
      expect(dlgBox).not.toBeNull();
      if (dlgBox) {
        expect(dlgBox.x + dlgBox.width).toBeLessThanOrEqual(vp.width + 1);
      }
      const { scrollW, clientW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(scrollW).toBeLessThanOrEqual(clientW + 1);

      // Interatividade: input de busca recebe foco e aceita digitação.
      const searchInput = dialog.locator('input').first();
      await expect(searchInput).toBeVisible();
      await searchInput.fill('caneca');
      await expect(searchInput).toHaveValue('caneca');
    });

    test('estado loading: botão fica disabled e anuncia via aria-disabled', async ({
      page,
    }) => {
      await gotoAndSettle(page, `${ROUTE}?loading=1`);
      const btn = page.getByTestId('quote-add-product-button-summary');
      await expect(btn).toBeDisabled();
      await expect(btn).toHaveAttribute('aria-disabled', 'true');

      // Clique não abre o dialog.
      await btn.click({ force: true }).catch(() => {});
      await expect(page.getByTestId('product-search-open-state')).toHaveAttribute(
        'data-open',
        '0',
      );
    });
  });
}

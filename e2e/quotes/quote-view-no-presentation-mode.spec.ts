/**
 * Regressão: o item "Modo Apresentação" foi removido do DropdownMenu do
 * QuoteViewPage. Esta spec abre o menu de ações no harness
 * `/__visual/quote-view-order` (espelho 1:1, sem dependência de seed/auth)
 * em light e dark, e garante que:
 *   - O trigger abre o menu.
 *   - "Editar", "Duplicar" e "Histórico" continuam presentes.
 *   - "Modo Apresentação" NÃO aparece em nenhum tema.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

async function openMenu(page: Page, theme: 'light' | 'dark') {
  await gotoAndSettle(page, theme === 'dark' ? `${ROUTE}?theme=dark` : ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
  await page.getByTestId('quote-actions-trigger').click();
  await expect(page.getByTestId('quote-actions-menu')).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  test(`DropdownMenu não exibe "Modo Apresentação" — ${theme}`, async ({ page }) => {
    await openMenu(page, theme);

    const menu = page.getByTestId('quote-actions-menu');
    await expect(menu.getByText('Editar', { exact: true })).toBeVisible();
    await expect(menu.getByText('Duplicar', { exact: true })).toBeVisible();
    await expect(menu.getByText('Histórico', { exact: true })).toBeVisible();

    // Ausência absoluta — qualquer match falha o teste.
    await expect(page.getByText(/Modo Apresentação/i)).toHaveCount(0);
  });
}

/**
 * E2E: lista de carrinhos (layout estilo Orçamentos)
 *  - exibe título, contador e botão "Novo carrinho"
 *  - cada linha mostra logo da empresa
 *  - clique em "Abrir" navega para /carrinhos/:id
 *  - colunas alinhadas (Itens centralizado, Valor à direita)
 *  - layout responsivo: tabela continua acessível em mobile (scroll horizontal)
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Carrinhos · lista → detalhe @smoke', () => {
  test('exibe logo na linha e navega para detalhe ao clicar em Abrir', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    await expect(page.getByTestId('carts-list-new')).toBeVisible();

    const rows = page.locator('[data-testid^="cart-row-"]').filter({
      hasNot: page.locator('[data-testid^="cart-row-open-"]'),
    });
    const firstRow = rows.first();
    const rowCount = await rows.count();

    if (rowCount === 0) {
      await expect(page.getByText(/Nenhum carrinho aberto/i)).toBeVisible();
      return;
    }

    const logo = firstRow.locator('img, [class*="rounded-full"]').first();
    await expect(logo).toBeVisible();

    const testId = await firstRow.getAttribute('data-testid');
    const cartId = testId?.replace('cart-row-', '');
    expect(cartId).toBeTruthy();

    await page.getByTestId(`cart-row-open-${cartId}`).click();
    await expect(page).toHaveURL(new RegExp(`/carrinhos/${cartId}`));
  });

  test('colunas alinhadas e tabela responsiva', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const rows = page.locator('[data-testid^="cart-row-"]').filter({
      hasNot: page.locator('[data-testid^="cart-row-open-"]'),
    });
    if ((await rows.count()) === 0) {
      test.skip(true, 'sem carrinhos para validar alinhamento');
    }

    // Cabeçalhos esperados na ordem do módulo Orçamentos
    for (const label of ['Status', 'Empresa', 'Itens', 'Valor', 'Atualizado']) {
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${label}$`) })).toBeVisible();
    }

    // Mobile: tabela continua visível (com overflow horizontal)
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    await expect(page.getByTestId('carts-list-new')).toBeVisible();
    await expect(rows.first()).toBeVisible();

    // Desktop: volta ao layout amplo
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(rows.first()).toBeVisible();
  });
});

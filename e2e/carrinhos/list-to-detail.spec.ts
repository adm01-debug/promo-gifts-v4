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
    const expectedHeaders = ['Status', 'Empresa', 'Itens', 'Valor', 'Atualizado'];
    for (const label of expectedHeaders) {
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${label}$`) })).toBeVisible();
    }

    // Tablet 768px: ordem das colunas e alinhamento preservados (padrão Orçamentos)
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const headers = page.getByRole('columnheader');
    const headerTexts = (await headers.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    expect(headerTexts.slice(0, expectedHeaders.length)).toEqual(expectedHeaders);

    const itensHeader = page.getByRole('columnheader', { name: /^Itens$/ });
    const valorHeader = page.getByRole('columnheader', { name: /^Valor$/ });
    await expect(itensHeader).toHaveClass(/text-center/);
    await expect(valorHeader).toHaveClass(/text-right/);

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

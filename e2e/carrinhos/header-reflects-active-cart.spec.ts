/**
 * E2E: ao alternar de carrinho, o header troca corretamente para os SKUs,
 * unidades e subtotal do carrinho selecionado — sem exibir agregados globais.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Carrinhos · header reflete carrinho ativo @carrinhos', () => {
  test('alterna SKUs/unidades/subtotal ao trocar de carrinho', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const rows = page.locator('[data-testid^="cart-row-"]').filter({
      hasNot: page.locator('[data-testid^="cart-row-open-"]'),
    });
    const total = await rows.count();
    if (total < 2) {
      test.skip(true, 'precisa de ao menos 2 carrinhos para validar alternância');
    }

    const ids: string[] = [];
    for (let i = 0; i < Math.min(total, 2); i++) {
      const tid = await rows.nth(i).getAttribute('data-testid');
      const id = tid?.replace('cart-row-', '');
      if (id) ids.push(id);
    }
    expect(ids.length).toBe(2);

    const readHeader = async () => {
      const title = await page.getByTestId('page-title-carrinhos').innerText();
      const meta = await page.getByTestId('page-title-carrinhos').locator('..').locator('p').first().innerText();
      return { title: title.trim(), meta: meta.trim() };
    };

    // Abre carrinho A
    await gotoAndSettle(page, `/carrinhos/${ids[0]}`);
    await expect(page).toHaveURL(new RegExp(`/carrinhos/${ids[0]}`));
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const a = await readHeader();

    // Sanidade: header não deve mostrar o formato agregado "N itens" da lista
    // (formato do carrinho ativo usa "SKU/SKUs" e "unidade/unidades").
    expect(a.meta).toMatch(/SKU|unidade/i);

    // Abre carrinho B
    await gotoAndSettle(page, `/carrinhos/${ids[1]}`);
    await expect(page).toHaveURL(new RegExp(`/carrinhos/${ids[1]}`));
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const b = await readHeader();
    expect(b.meta).toMatch(/SKU|unidade/i);

    // Título (nome da empresa) OU meta (SKUs/unidades/subtotal) DEVE mudar
    // entre carrinhos distintos.
    expect(a.title !== b.title || a.meta !== b.meta).toBeTruthy();
  });
});

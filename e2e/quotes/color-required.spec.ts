import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { waitForTestId, expectVisibleByTestId } from '../helpers/waits';

/**
 * Fluxo "Adicionar Produto" ao orçamento:
 * - cor é obrigatória (não existe mais opção "adicionar sem cor")
 * - cores com estoque zerado abrem AlertDialog de confirmação
 * - cancelar mantém o usuário no seletor; confirmar adiciona o item
 * - backend recusa INSERT em quote_items sem color_name
 */
test.describe('Orçamento — seleção de cor obrigatória', () => {
  test('cor em estoque adiciona direto; sem estoque pede confirmação', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/orcamentos/novo');

    await page.getByTestId('quote-add-product-button').first().click();
    await waitForTestId(page, 'quote-add-product-modal');

    await page.getByTestId('product-search-input').fill('');
    await page.getByTestId(/^product-search-result-/).first().click();

    // Não existe mais o hint antigo nem a opção "adicionar sem cor"
    await expect(page.getByTestId('color-required-hint')).toHaveCount(0);
    await expect(page.getByTestId('product-add-without-color')).toHaveCount(0);

    const oosTiles = page.getByTestId('color-variant-tile-out-of-stock');
    const oosCount = await oosTiles.count();

    if (oosCount > 0) {
      // Cancelar: dialog abre e fecha sem adicionar item
      await oosTiles.first().click();
      await expectVisibleByTestId(page, 'out-of-stock-confirm-dialog');
      await expect(
        page.getByTestId('out-of-stock-confirm-dialog'),
      ).toContainText(/estoque.*zerado/i);
      await page.getByTestId('out-of-stock-confirm-cancel').click();
      await expect(page.getByTestId('out-of-stock-confirm-dialog')).toHaveCount(0);
      await expect(page.getByTestId('quote-add-product-modal')).toBeVisible();
      await expect(page.getByTestId('quote-item-row')).toHaveCount(0);

      // Confirmar: adiciona o item mesmo com estoque zerado
      await oosTiles.first().click();
      await expectVisibleByTestId(page, 'out-of-stock-confirm-dialog');
      await page.getByTestId('out-of-stock-confirm-accept').click();
      await expect(page.getByTestId('quote-add-product-modal')).toHaveCount(0);
      await expectVisibleByTestId(page, 'quote-item-row');
    } else {
      // Sem variantes OOS: clique em tile válido adiciona direto
      const validTile = page.getByTestId('color-variant-tile').first();
      await expect(validTile).toBeEnabled();
      await validTile.click();
      await expect(page.getByTestId('quote-add-product-modal')).toHaveCount(0);
      await expectVisibleByTestId(page, 'quote-item-row');
    }
  });

  test('backend rejeita INSERT em quote_items sem color_name', async ({ page }) => {
    await loginAs(page, 'seller');

    const result = await page.evaluate(async () => {
      const mod = await import('/src/integrations/supabase/client.ts');
      const { error } = await mod.supabase
        .from('quote_items')
        .insert({
          quote_id: '00000000-0000-0000-0000-000000000000',
          product_id: '00000000-0000-0000-0000-000000000000',
          product_name: 'Teste sem cor',
          quantity: 1,
          unit_price: 1,
          subtotal: 1,
          color_name: null,
        } as never);
      return { code: error?.code ?? null, message: error?.message ?? null };
    });

    expect(['23514', '42501']).toContain(result.code);
    if (result.code === '23514') {
      expect(result.message).toMatch(/quote_items_color_required/i);
    }
  });
});

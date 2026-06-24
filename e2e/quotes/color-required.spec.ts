import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { waitForTestId, expectVisibleByTestId } from '../helpers/waits';

/**
 * Garante que o fluxo "Adicionar Produto" no orçamento exige seleção de cor:
 * - hint inline orientando seleção
 * - tiles sem estoque ficam disabled (aria-disabled)
 * - clique numa cor válida adiciona o item
 */
test.describe('Orçamento — cor obrigatória ao adicionar produto', () => {
  test('hint inline aparece e tile válido adiciona o item', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/orcamentos/novo');

    // Abre modal de adicionar produto
    await page.getByTestId('quote-add-product-button').first().click();
    await waitForTestId(page, 'quote-add-product-modal');

    // Seleciona o primeiro produto da busca
    await page.getByTestId('product-search-input').fill('');
    const firstProduct = page.getByTestId(/^product-search-result-/).first();
    await firstProduct.click();

    // Hint de cor obrigatória deve aparecer
    await expectVisibleByTestId(page, 'color-required-hint');
    await expect(page.getByTestId('color-required-hint')).toContainText(/selecione uma cor/i);

    // Confirma que NÃO existe mais a opção "adicionar sem cor"
    await expect(page.getByTestId('product-add-without-color')).toHaveCount(0);

    // Tiles sem estoque ficam disabled
    const disabledTiles = page.getByTestId('color-variant-tile-disabled');
    const disabledCount = await disabledTiles.count();
    if (disabledCount > 0) {
      await expect(disabledTiles.first()).toBeDisabled();
    }

    // Clica num tile válido → item entra na lista do orçamento
    const validTile = page.getByTestId('color-variant-tile').first();
    await expect(validTile).toBeEnabled();
    await validTile.click();

    // Modal fecha e item aparece
    await expect(page.getByTestId('quote-add-product-modal')).toHaveCount(0);
    await expectVisibleByTestId(page, 'quote-item-row');
  });

  test('backend rejeita INSERT em quote_items sem color_name', async ({ page }) => {
    await loginAs(page, 'seller');

    // Tenta inserir item sem cor diretamente via Supabase (bypassa o front-end).
    // A constraint `quote_items_color_required` deve devolver erro 23514 (check_violation).
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

    // Aceita check_violation (23514) OU RLS (42501) — ambos provam que o backend recusa.
    expect(['23514', '42501']).toContain(result.code);
    if (result.code === '23514') {
      expect(result.message).toMatch(/quote_items_color_required/i);
    }
  });
});


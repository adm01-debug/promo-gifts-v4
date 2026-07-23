/**
 * E2E — Handoff Carrinho → QuoteBuilder · Persistência pós-reload/troca de aba
 *
 * Cenário complementar ao BUG-CART-HANDOFF:
 *   1. Semeia rascunho antigo em localStorage.
 *   2. Abre QuoteBuilder a partir de um carrinho — dados do carrinho vencem.
 *   3. Aguarda o autosave regravar o localStorage (~2s).
 *   4. Recarrega a página e simula troca de aba (visibilitychange).
 *   5. Invariante: cliente e itens do CARRINHO continuam presentes; nunca
 *      voltam para o rascunho antigo.
 */
import { test, expect } from '@playwright/test';
import { setupAuthedWithCarts } from '../helpers/cart-setup';
import { gotoAndSettle } from '../helpers/nav';
import type { MockCart } from '../helpers/cart-mock';

const STALE_DRAFT = {
  version: 2,
  data: {
    clientId: 'stale-sicoob-uuid',
    contactId: null,
    companyInfo: {
      id: 'stale-sicoob-uuid',
      name: 'Sicoob Fluminense (ANTIGO)',
      cnpj: '00.000.000/0001-00',
    },
    contactInfo: null,
    items: [
      {
        product_id: 'stale-product-id',
        product_name: 'Produto DO RASCUNHO ANTIGO (não deveria aparecer)',
        product_sku: 'STALE-SKU',
        quantity: 999,
        unit_price: 1234.56,
        personalizations: [],
      },
    ],
    discountType: 'percent',
    discountValue: 0,
    negotiationMarkup: 0,
    paymentMethod: 'boleto',
    paymentTerms: '28',
    deliveryTime: '28',
    shippingType: 'FOB',
    shippingCost: 0,
    notes: 'notas antigas',
    validUntil: '',
  },
  savedAt: new Date(Date.now() - 3_600_000).toISOString(),
};

test.describe('Handoff Carrinho → QuoteBuilder · persistência pós-reload/troca de aba @carrinhos', () => {
  test('autosave não sobrescreve dados do carrinho após reload ou visibility change', async ({
    page,
  }) => {
    await loginAs(page, 'seller');

    const cart: MockCart = makeMockCart(0, 2);
    cart.company_name = '123 Solar (DO CARRINHO)';
    cart.seller_cart_items[0].product_name = 'Produto CORRETO do carrinho';
    await mockSellerCartsAPI(page, [cart]);

    await page.addInitScript((draft) => {
      window.localStorage.setItem('quote_builder_autosave', JSON.stringify(draft));
    }, STALE_DRAFT);

    // Handoff via lista de carrinhos.
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    await page.getByTestId(`cart-row-more-${cart.id}`).click();
    await page.getByTestId(`cart-row-menu-generate-quote-${cart.id}`).click();

    await expect(page).toHaveURL(/\/orcamentos\/novo/);
    await expect(page.getByTestId('quote-builder-grid')).toBeVisible();
    await expect(page.getByTestId('quote-summary-item-0')).toContainText(
      'Produto CORRETO do carrinho',
    );

    // Espera o autosave regravar (throttle ~2s).
    await page.waitForTimeout(2500);

    // Snapshot do localStorage APÓS autosave regravar — deve refletir carrinho.
    const afterAutosave = await page.evaluate(() =>
      window.localStorage.getItem('quote_builder_autosave'),
    );
    expect(afterAutosave).toBeTruthy();
    expect(afterAutosave).not.toContain('stale-product-id');
    expect(afterAutosave).not.toContain('Sicoob Fluminense (ANTIGO)');

    // 1) Simula troca de aba: dispatch visibilitychange (hidden → visible).
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Invariante: itens do carrinho continuam; rascunho antigo NÃO reapareceu.
    const summaryScroll = page.getByTestId('quote-summary-items-scroll');
    await expect(page.getByTestId('quote-summary-item-0')).toContainText(
      'Produto CORRETO do carrinho',
    );
    await expect(summaryScroll).not.toContainText('RASCUNHO ANTIGO');
    await expect(summaryScroll).not.toContainText('Sicoob Fluminense (ANTIGO)');

    // 2) Reload — o autosave DEVE restaurar dados do carrinho (nunca o antigo).
    await page.reload();
    await expect(page.getByTestId('quote-builder-grid')).toBeVisible();
    await expect(summaryScroll).not.toContainText('RASCUNHO ANTIGO');
    await expect(summaryScroll).not.toContainText('Sicoob Fluminense (ANTIGO)');

    const afterReload = await page.evaluate(() =>
      window.localStorage.getItem('quote_builder_autosave'),
    );
    if (afterReload) {
      expect(afterReload).not.toContain('stale-product-id');
      expect(afterReload).not.toContain('Sicoob Fluminense (ANTIGO)');
    }
  });
});

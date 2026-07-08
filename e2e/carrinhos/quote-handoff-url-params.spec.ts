/**
 * E2E — Handoff QuoteBuilder via URL params · autosave não pode restaurar rascunho antigo
 *
 * Cenário complementar ao BUG-CART-HANDOFF: quando o QuoteBuilder é aberto via
 * `/orcamentos/novo?product_id=...&product_name=...`, um rascunho antigo em
 * localStorage NÃO pode sobrescrever o produto vindo da URL — nem no primeiro
 * render, nem após reload, nem após visibilitychange (troca de aba).
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STALE_DRAFT = {
  version: 2,
  data: {
    clientId: 'stale-client-uuid',
    contactId: null,
    companyInfo: {
      id: 'stale-client-uuid',
      name: 'Cliente ANTIGO (rascunho)',
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
    notes: '',
    validUntil: '',
  },
  savedAt: new Date(Date.now() - 3_600_000).toISOString(),
};

const URL_PRODUCT = {
  product_id: 'url-product-42',
  product_name: 'Produto CORRETO via URL',
  product_sku: 'URL-SKU-42',
  product_price: '99.90',
  min_quantity: '50',
};

test.describe('Handoff QuoteBuilder via URL params · rascunho antigo NÃO sobrescreve @carrinhos', () => {
  test('URL params vencem autosave no first render, reload e visibilitychange', async ({
    page,
  }) => {
    await loginAs(page, 'seller');

    // Semeia rascunho antigo ANTES da navegação.
    await page.addInitScript((draft) => {
      window.localStorage.setItem('quote_builder_autosave', JSON.stringify(draft));
    }, STALE_DRAFT);

    const qs = new URLSearchParams(URL_PRODUCT).toString();
    await gotoAndSettle(page, `/orcamentos/novo?${qs}`);

    // 1) First render — item da URL, não do rascunho.
    const summaryScroll = page.getByTestId('quote-summary-items-scroll');
    const firstItem = page.getByTestId('quote-summary-item-0');
    await expect(firstItem).toBeVisible();
    await expect(firstItem).toContainText('Produto CORRETO via URL');
    await expect(summaryScroll).not.toContainText('RASCUNHO ANTIGO');

    // Espera autosave regravar (throttle ~2s).
    await page.waitForTimeout(2500);
    const afterAutosave = await page.evaluate(() =>
      window.localStorage.getItem('quote_builder_autosave'),
    );
    expect(afterAutosave).toBeTruthy();
    expect(afterAutosave).not.toContain('stale-product-id');
    expect(afterAutosave).not.toContain('Cliente ANTIGO');

    // 2) Troca de aba — visibilitychange hidden → visible.
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
    await expect(firstItem).toContainText('Produto CORRETO via URL');
    await expect(summaryScroll).not.toContainText('RASCUNHO ANTIGO');

    // 3) Reload — o autosave DEVE restaurar dados corretos (nunca o antigo).
    //    Após reload a URL preserva os query params, então o handoff roda de
    //    novo e/ou o autosave (já regravado) traz o produto correto.
    await page.reload();
    await expect(page.getByTestId('quote-builder-grid')).toBeVisible();
    await expect(summaryScroll).not.toContainText('RASCUNHO ANTIGO');
    await expect(summaryScroll).not.toContainText('Cliente ANTIGO');
  });
});

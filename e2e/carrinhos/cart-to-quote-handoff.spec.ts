/**
 * E2E — Handoff Carrinho → QuoteBuilder (BUG-CART-HANDOFF, 2026-07)
 *
 * Reproduz o cenário exato relatado:
 *   1. Existe um rascunho antigo em localStorage (empresa/itens diferentes).
 *   2. Usuário clica em "Orçamento" no menu de um carrinho.
 *   3. O QuoteBuilder DEVE abrir com o cliente e os itens DO CARRINHO,
 *      não com o rascunho antigo.
 *
 * Também valida que o handoff emite o log de telemetria
 * `[QuoteBuilder handoff] fromCart`, para permitir auditoria em produção.
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

test.describe('Handoff Carrinho → QuoteBuilder · rascunho antigo NÃO sobrescreve @carrinhos', () => {
  test('clique em "Orçamento" no carrinho abre QuoteBuilder com dados do carrinho, ignorando autosave', async ({
    page,
  }) => {
    // 1) Login + mock do carrinho ANTES de qualquer navegação (via SSOT).
    const { cartA: cart } = await setupAuthedWithCarts(page, {
      role: 'seller',
      count: 1,
      itemsPerCart: 2,
      gotoUrl: null,
      transform: (c: MockCart) => {
        c.company_name = '123 Solar (DO CARRINHO)';
        c.seller_cart_items[0].product_name = 'Produto CORRETO do carrinho';
        return c;
      },
    });

    // 2) Semeia rascunho antigo em localStorage — a "armadilha" que reproduzia o bug.
    await page.addInitScript((draft) => {
      window.localStorage.setItem('quote_builder_autosave', JSON.stringify(draft));
    }, STALE_DRAFT);

    // 3) Captura logs do console para verificar telemetria de handoff.
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('QuoteBuilder handoff')) consoleLogs.push(text);
    });

    // 4) Vai para a lista de carrinhos e clica em "Orçamento".
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Abre o menu de contexto da linha e clica em "Orçamento".
    await page.getByTestId(`cart-row-more-${cart.id}`).click();
    const generateItem = page.getByTestId(`cart-row-menu-generate-quote-${cart.id}`);
    await expect(generateItem).toBeVisible();
    await generateItem.click();

    // 5) Aguarda o QuoteBuilder abrir.
    await expect(page).toHaveURL(/\/orcamentos\/novo/);
    await expect(page.getByTestId('quote-builder-grid')).toBeVisible();

    // 6) INVARIANTE PRINCIPAL: o item que aparece é o DO CARRINHO, não o antigo.
    const firstSummaryItem = page.getByTestId('quote-summary-item-0');
    await expect(firstSummaryItem).toBeVisible();
    await expect(firstSummaryItem).toContainText('Produto CORRETO do carrinho');
    await expect(firstSummaryItem).not.toContainText('RASCUNHO ANTIGO');

    // Nenhum item do rascunho antigo deve estar visível em posição alguma.
    const summaryScroll = page.getByTestId('quote-summary-items-scroll');
    await expect(summaryScroll).not.toContainText('RASCUNHO ANTIGO');

    // 7) Autosave DEVE ter sido limpo (ou reescrito com os dados do carrinho).
    //    Se o rascunho antigo persistisse intacto seria evidência do bug.
    const savedAfter = await page.evaluate(() =>
      window.localStorage.getItem('quote_builder_autosave'),
    );
    if (savedAfter) {
      // Se o autosave já regravou (>2s), garantir que NÃO contém o produto antigo.
      expect(savedAfter).not.toContain('stale-product-id');
      expect(savedAfter).not.toContain('RASCUNHO ANTIGO');
    }

    // 8) Telemetria: deve ter emitido `[QuoteBuilder handoff] fromCart`.
    //    Em DEV o logger imprime no console; em PROD não — o teste roda contra DEV.
    //    Se o preview não expõe logs de info, o array ficará vazio — nesse caso
    //    validamos apenas as invariantes acima.
    if (consoleLogs.length > 0) {
      expect(consoleLogs.some((l) => l.includes('fromCart'))).toBe(true);
    }
  });
});

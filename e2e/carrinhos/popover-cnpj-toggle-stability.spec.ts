/**
 * E2E · Estabilidade do subtítulo (CNPJ vs ramo) sob abre/fecha repetido.
 *
 * Cenário: o popover "Meus Carrinhos" faz lookup dinâmico no CRM
 * (`useCrmCompanies`, cache 10min). Um bug de cache/timeout poderia fazer
 * o subtítulo "piscar" entre CNPJ e ramo a cada abertura. Este teste abre
 * e fecha o popover 6 vezes e garante que o `data-kind` + texto permanecem
 * IDÊNTICOS em todas as aberturas — para cada carrinho da lista.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart, type MockCart } from '../helpers/cart-mock';

const CNPJ_RAW = '38457038000160';
const CNPJ_MASKED = '38.457.038/0001-60';

function buildCarts(): MockCart[] {
  const cnpjCart = makeMockCart(0, 1);
  cnpjCart.company_id = 'co-toggle-cnpj';
  cnpjCart.company_name = 'Empresa Toggle CNPJ';
  cnpjCart.company_location = CNPJ_RAW;

  const ramoCart = makeMockCart(1, 1);
  ramoCart.company_id = 'co-toggle-ramo';
  ramoCart.company_name = 'Empresa Toggle Ramo';
  ramoCart.company_location = 'Serviços de logística';
  return [cnpjCart, ramoCart];
}

/**
 * CRM que responde APENAS para `co-toggle-cnpj` — o outro carrinho força
 * fallback ao ramo. Também simula latência variável para expor bugs de
 * cache: primeiras chamadas atrasam 200ms, depois respondem imediato.
 */
async function mockCrmWithLatency(page: Page): Promise<void> {
  let calls = 0;
  await page.route(/\/functions\/v1\/crm-db-bridge(\?|$|\/)/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    let body: { table?: string } = {};
    try {
      body = JSON.parse(route.request().postData() ?? '{}');
    } catch {
      /* ignore */
    }
    if (body.table !== 'companies') return route.continue();

    calls += 1;
    if (calls <= 2) await new Promise((r) => setTimeout(r, 200));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'co-toggle-cnpj',
            razao_social: 'Empresa Toggle CNPJ',
            nome_fantasia: null,
            ramo_atividade: null,
            logo_url: null,
            cnpj: CNPJ_RAW,
          },
        ],
        count: 1,
      }),
    });
  });
}

async function openPopover(page: Page): Promise<void> {
  await page.getByTestId('cart-trigger').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
}

async function closePopover(page: Page): Promise<void> {
  // ESC é mais estável que clicar fora — evita hit em outro elemento clicável.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('cart-drawer')).toBeHidden();
}

test.describe('Carrinhos · popover subtítulo estável sob toggle repetido @smoke', () => {
  test('6 aberturas consecutivas mantêm data-kind + texto idênticos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, 'seller');

    await mockSellerCartsAPI(page, buildCarts());
    await mockCrmWithLatency(page);

    await gotoAndSettle(page, '/');

    const observed: Array<{ cnpj: [string, string]; ramo: [string, string] }> = [];

    for (let i = 0; i < 6; i++) {
      await openPopover(page);

      const cnpjSubtitle = page.getByTestId('cart-company-subtitle-mock-cart-0');
      const ramoSubtitle = page.getByTestId('cart-company-subtitle-mock-cart-1');

      await expect(cnpjSubtitle).toBeVisible();
      await expect(ramoSubtitle).toBeVisible();

      observed.push({
        cnpj: [
          (await cnpjSubtitle.getAttribute('data-kind')) ?? '',
          (await cnpjSubtitle.textContent())?.trim() ?? '',
        ],
        ramo: [
          (await ramoSubtitle.getAttribute('data-kind')) ?? '',
          (await ramoSubtitle.textContent())?.trim() ?? '',
        ],
      });

      await closePopover(page);
    }

    // Estabilidade absoluta: nenhuma abertura pode ter divergido da primeira.
    const first = observed[0];
    for (let i = 1; i < observed.length; i++) {
      expect(observed[i], `abertura #${i + 1} divergiu da primeira`).toEqual(first);
    }

    // E ainda validamos o valor esperado (contra caso "todas iguais mas erradas").
    expect(first.cnpj).toEqual(['cnpj', CNPJ_MASKED]);
    expect(first.ramo[0]).toBe('ramo');
    expect(first.ramo[1]).toBe('Serviços de logística');
  });
});

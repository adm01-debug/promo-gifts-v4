/**
 * E2E · Popover "Meus Carrinhos" exibe CNPJ da empresa (com fallback ao ramo).
 *
 * Cenários cobertos (regra em `resolveCartCompanyCnpj`):
 *   [cart-0] legado — company_location guarda ramo, CRM entrega CNPJ.
 *            Esperado: CNPJ formatado + classe `font-mono` + data-kind="cnpj".
 *   [cart-1] novo   — company_location já é o CNPJ cru (14 dígitos).
 *            Esperado: CNPJ formatado + `font-mono` + data-kind="cnpj",
 *            SEM depender do CRM.
 *   [cart-2] fallback — CRM não retorna CNPJ para essa empresa e
 *            company_location contém ramo → exibe o ramo (legado).
 *            Esperado: texto do ramo + data-kind="ramo" (sem `font-mono`).
 *
 * Também exercita o comportamento defensivo quando `crm-db-bridge` responde:
 *   - com CNPJ apenas de PARTE das empresas (serviço lento/timeout)
 *   - com 503 (indisponível) — o popover deve continuar renderizando os
 *     fallbacks sem quebrar.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart, type MockCart } from '../helpers/cart-mock';

const CNPJ_LEGACY_RAW = '38457038000160';
const CNPJ_LEGACY_MASKED = '38.457.038/0001-60';
const CNPJ_NEW_RAW = '11222333000181';
const CNPJ_NEW_MASKED = '11.222.333/0001-81';

/**
 * Monta 3 carrinhos com diferentes cenários de subtitle.
 */
function buildMixedCarts(): MockCart[] {
  const legacy = makeMockCart(0, 1);
  legacy.company_id = 'co-legacy';
  legacy.company_name = 'Empresa Legada';
  legacy.company_location = 'Peças automotivas | Indústria';

  const fresh = makeMockCart(1, 1);
  fresh.company_id = 'co-fresh';
  fresh.company_name = 'Empresa Nova';
  fresh.company_location = CNPJ_NEW_RAW; // já veio como CNPJ do picker novo

  const fallback = makeMockCart(2, 1);
  fallback.company_id = 'co-orphan';
  fallback.company_name = 'Empresa Sem CNPJ';
  fallback.company_location = 'Cooperativas de Crédito';

  return [legacy, fresh, fallback];
}

/**
 * Mocka o edge `crm-db-bridge`. `cnpjByCompanyId` diz quais empresas voltam
 * com CNPJ; empresas fora do mapa voltam sem cnpj (simulando registro
 * incompleto no CRM ou serviço lento que ainda não indexou).
 */
async function mockCrmCompanies(
  page: Page,
  cnpjByCompanyId: Record<string, string | null>,
): Promise<void> {
  await page.route(/\/functions\/v1\/crm-db-bridge(\?|$|\/)/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    let body: { table?: string; operation?: string } = {};
    try {
      body = JSON.parse(route.request().postData() ?? '{}');
    } catch {
      /* ignore */
    }
    if (body.table !== 'companies') return route.continue();

    const rows = Object.entries(cnpjByCompanyId).map(([id, cnpj]) => ({
      id,
      razao_social: `Empresa ${id}`,
      nome_fantasia: null,
      ramo_atividade: null,
      logo_url: null,
      cnpj,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: rows, count: rows.length }),
    });
  });
}

async function mockCrmOffline(page: Page): Promise<void> {
  await page.route(/\/functions\/v1\/crm-db-bridge(\?|$|\/)/, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'CRM unreachable' }),
    });
  });
}

async function openPopover(page: Page): Promise<void> {
  await page.getByTestId('cart-trigger').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
}

test.describe('Carrinhos · popover exibe CNPJ com fallback ao ramo @smoke', () => {
  test('carrinho legado (CRM entrega CNPJ) → CNPJ mascarado com font-mono', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, 'seller');

    const carts = buildMixedCarts();
    await mockSellerCartsAPI(page, carts);
    await mockCrmCompanies(page, {
      'co-legacy': CNPJ_LEGACY_RAW,
      'co-fresh': null, // sem CNPJ no CRM — força fallback para company_location
      // 'co-orphan' ausente — simula empresa que sequer voltou do CRM
    });

    await gotoAndSettle(page, '/');
    await openPopover(page);

    const legacySubtitle = page.getByTestId('cart-company-subtitle-mock-cart-0');
    await expect(legacySubtitle).toBeVisible();
    await expect(legacySubtitle).toHaveText(CNPJ_LEGACY_MASKED);
    await expect(legacySubtitle).toHaveAttribute('data-kind', 'cnpj');
    await expect(legacySubtitle).toHaveClass(/font-mono/);
  });

  test('carrinho novo (CNPJ em company_location) → CNPJ mascarado sem depender do CRM', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, 'seller');

    const carts = buildMixedCarts();
    await mockSellerCartsAPI(page, carts);
    // CRM offline propositalmente — carrinho novo deve renderizar CNPJ do
    // company_location cru (14 dígitos) sem regressão.
    await mockCrmOffline(page);

    await gotoAndSettle(page, '/');
    await openPopover(page);

    const freshSubtitle = page.getByTestId('cart-company-subtitle-mock-cart-1');
    await expect(freshSubtitle).toBeVisible();
    await expect(freshSubtitle).toHaveText(CNPJ_NEW_MASKED);
    await expect(freshSubtitle).toHaveAttribute('data-kind', 'cnpj');
    await expect(freshSubtitle).toHaveClass(/font-mono/);
  });

  test('carrinho sem CNPJ no CRM → exibe ramo (fallback legado)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, 'seller');

    const carts = buildMixedCarts();
    await mockSellerCartsAPI(page, carts);
    await mockCrmCompanies(page, {
      'co-legacy': CNPJ_LEGACY_RAW,
      // 'co-orphan' ausente — CRM incompleto
    });

    await gotoAndSettle(page, '/');
    await openPopover(page);

    const fallbackSubtitle = page.getByTestId('cart-company-subtitle-mock-cart-2');
    await expect(fallbackSubtitle).toBeVisible();
    await expect(fallbackSubtitle).toHaveText('Cooperativas de Crédito');
    await expect(fallbackSubtitle).toHaveAttribute('data-kind', 'ramo');
    // Garantia negativa: NÃO deve receber `font-mono` (isso é reservado a CNPJ).
    await expect(fallbackSubtitle).not.toHaveClass(/font-mono/);
  });

  test('CRM 503 → todos os carrinhos caem para fallback sem quebrar o popover', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, 'seller');

    const carts = buildMixedCarts();
    await mockSellerCartsAPI(page, carts);
    await mockCrmOffline(page);

    await gotoAndSettle(page, '/');
    await openPopover(page);

    // Legado sem CRM → mostra ramo original (não mais CNPJ)
    await expect(page.getByTestId('cart-company-subtitle-mock-cart-0')).toHaveAttribute(
      'data-kind',
      'ramo',
    );
    await expect(page.getByTestId('cart-company-subtitle-mock-cart-0')).toHaveText(
      'Peças automotivas | Indústria',
    );

    // Novo com CNPJ em company_location → segue mostrando CNPJ (independente do CRM)
    await expect(page.getByTestId('cart-company-subtitle-mock-cart-1')).toHaveAttribute(
      'data-kind',
      'cnpj',
    );
    await expect(page.getByTestId('cart-company-subtitle-mock-cart-1')).toHaveText(
      CNPJ_NEW_MASKED,
    );

    // Fallback puro
    await expect(page.getByTestId('cart-company-subtitle-mock-cart-2')).toHaveAttribute(
      'data-kind',
      'ramo',
    );
  });
});

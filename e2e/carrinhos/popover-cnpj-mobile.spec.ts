/**
 * E2E · Popover "Meus Carrinhos" em layout mobile (viewport 390x844).
 *
 * Objetivo: garantir que o CNPJ formatado (ou fallback ao ramo) permanece
 * visível e legível em telas pequenas, sem truncar de forma silenciosa
 * (data-kind continua acessível) e sem quebrar o layout do drawer.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart, type MockCart } from '../helpers/cart-mock';

const CNPJ_RAW = '38457038000160';
const CNPJ_MASKED = '38.457.038/0001-60';

function buildCarts(): MockCart[] {
  const withCnpj = makeMockCart(0, 1);
  withCnpj.company_id = 'co-mobile-cnpj';
  withCnpj.company_name = 'Empresa Mobile CNPJ';
  withCnpj.company_location = CNPJ_RAW;

  const withRamo = makeMockCart(1, 1);
  withRamo.company_id = 'co-mobile-ramo';
  withRamo.company_name = 'Empresa Mobile Ramo';
  withRamo.company_location = 'Comércio varejista';
  return [withCnpj, withRamo];
}

async function mockCrmOffline(page: Page): Promise<void> {
  await page.route(/\/functions\/v1\/crm-db-bridge(\?|$|\/)/, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'CRM unreachable' }),
    }),
  );
}

test.describe('Carrinhos · popover CNPJ em mobile @smoke', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('CNPJ mascarado é visível em viewport mobile e mantém data-kind=cnpj', async ({ page }) => {
    await loginAs(page, 'seller');
    await mockSellerCartsAPI(page, buildCarts());
    await mockCrmOffline(page);

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const subtitle = page.getByTestId('cart-company-subtitle-mock-cart-0');
    await expect(subtitle).toBeVisible();
    await expect(subtitle).toHaveText(CNPJ_MASKED);
    await expect(subtitle).toHaveAttribute('data-kind', 'cnpj');
    await expect(subtitle).toHaveClass(/font-mono/);

    // Sanidade visual: elemento tem largura > 0 e caixa dentro do viewport
    const box = await subtitle.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1);
  });

  test('fallback ao ramo em mobile mantém data-kind=ramo sem font-mono', async ({ page }) => {
    await loginAs(page, 'seller');
    await mockSellerCartsAPI(page, buildCarts());
    await mockCrmOffline(page);

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const subtitle = page.getByTestId('cart-company-subtitle-mock-cart-1');
    await expect(subtitle).toBeVisible();
    await expect(subtitle).toHaveText('Comércio varejista');
    await expect(subtitle).toHaveAttribute('data-kind', 'ramo');
    await expect(subtitle).not.toHaveClass(/font-mono/);
  });
});

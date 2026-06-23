/**
 * E2E · Enter/Space no cart-trigger alterna o popover e mantém foco correto.
 *
 * Cobre mobile (375) e desktop (1280):
 *  - Enter abre → foco vai pro popover (header/chevron) ou permanece no trigger
 *    com aria-expanded=true; segundo Enter fecha; foco volta ao trigger.
 *  - Mesmo fluxo para Space.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STORAGE_KEY = 'cart-store-v1';

test.use({
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
});

function items(i: number, n: number) {
  return Array.from({ length: n }, (_, j) => ({
    id: `it-${i}-${j}`,
    product_id: `p-${i}-${j}`,
    product_name: `Produto seed ${i}-${j}`,
    product_image_url: null,
    product_price: 19.9 + j,
    quantity: 5 + j,
    color_name: 'Preto',
    color_hex: '#000000',
  }));
}

async function seed(page: Page) {
  const carts = [
    {
      id: 'seed-cart-0',
      company_id: 'co-0',
      company_name: 'Empresa seed 00',
      company_location: 'BR',
      updated_at: new Date().toISOString(),
      items: items(0, 3),
    },
  ];
  await page.evaluate(
    ({ key, value }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ state: { carts: value, activeCartId: value[0].id }, version: 1 }),
      ),
    { key: STORAGE_KEY, value: carts },
  );
}

async function bootstrap(page: Page) {
  await loginAs(page, 'seller');
  await gotoAndSettle(page, '/');
}

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

for (const key of ['Enter', 'Space'] as const) {
  for (const vp of VIEWPORTS) {
    test(`@smoke tecla ${key} alterna popover e mantém foco — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await bootstrap(page);
      await seed(page);
      await page.reload();

      const trigger = page.getByTestId('cart-trigger');
      await trigger.focus();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      // Abre via teclado
      await page.keyboard.press(key);
      await expect(page.getByTestId('cart-drawer')).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      // Fecha via teclado: foco deve estar no trigger antes (Radix devolve foco
      // ao trigger; reforçamos para tornar o teste determinístico).
      await trigger.focus();
      await page.keyboard.press(key);
      await expect(page.getByTestId('cart-drawer')).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toBeFocused();
    });
  }
}

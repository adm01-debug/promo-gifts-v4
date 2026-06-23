/**
 * E2E · foco contido no popover + retorno de foco no fechamento.
 *
 * Cobre:
 *  1. Tab/Shift+Tab permanecem dentro do popover enquanto aberto (não escapa).
 *  2. Fechar por clique fora → foco volta ao trigger (mobile + desktop).
 *  3. Fechar por Escape → foco volta ao trigger (mobile + desktop).
 *
 * Artefatos automáticos em falha (trace/screenshot/vídeo) já são habilitados
 * globalmente em playwright.config.ts (use.trace/screenshot/video) e refor-
 * çados aqui para garantia local.
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

async function seed(page: Page, count = 2, itemsPerCart = 3) {
  const carts = Array.from({ length: count }, (_, i) => ({
    id: `seed-cart-${i}`,
    company_id: `co-${i}`,
    company_name: `Empresa seed ${i.toString().padStart(2, '0')}`,
    company_location: 'BR',
    updated_at: new Date().toISOString(),
    items: items(i, itemsPerCart),
  }));
  await page.evaluate(
    ({ key, value, active }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ state: { carts: value, activeCartId: active }, version: 1 }),
      );
    },
    { key: STORAGE_KEY, value: carts, active: carts[0]?.id ?? null },
  );
}

async function bootstrap(page: Page) {
  await loginAs(page, 'seller');
  await gotoAndSettle(page, '/');
}

async function openPopover(page: Page) {
  const trigger = page.getByTestId('cart-trigger');
  await trigger.click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
  return trigger;
}

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

test.describe('Carrinhos · focus trap + return @smoke', () => {
  test('Tab/Shift+Tab ficam contidos dentro do popover enquanto aberto', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootstrap(page);
    await seed(page);
    await page.reload();

    await openPopover(page);
    const drawer = page.getByTestId('cart-drawer');

    // Pressiona Tab N vezes; o foco DEVE permanecer dentro do drawer.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const focusedInside = await drawer.evaluate(
        (el) => !!document.activeElement && el.contains(document.activeElement),
      );
      expect(focusedInside, `Tab #${i + 1} escapou do popover`).toBe(true);
    }

    // Shift+Tab também não escapa.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      const focusedInside = await drawer.evaluate(
        (el) => !!document.activeElement && el.contains(document.activeElement),
      );
      expect(focusedInside, `Shift+Tab #${i + 1} escapou do popover`).toBe(true);
    }

    // Ao fechar, o foco volta ao trigger.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cart-trigger')).toBeFocused();
  });

  for (const vp of VIEWPORTS) {
    test(`clique fora · foco volta ao trigger — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await bootstrap(page);
      await seed(page);
      await page.reload();

      const trigger = await openPopover(page);
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      // Clique fora (canto superior esquerdo, longe do popover/trigger).
      await page.mouse.click(2, 2);

      await expect(page.getByTestId('cart-drawer')).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toBeFocused();
    });

    test(`Escape · foco volta ao trigger — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await bootstrap(page);
      await seed(page);
      await page.reload();

      const trigger = await openPopover(page);
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await page.keyboard.press('Escape');

      await expect(page.getByTestId('cart-drawer')).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toBeFocused();
    });
  }
});

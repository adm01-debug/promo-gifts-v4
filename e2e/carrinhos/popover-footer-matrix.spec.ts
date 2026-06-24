/**
 * E2E · matriz exaustiva de viewports para garantir que o footer
 * "Gerar Orçamento" do popover de carrinhos nunca seja cortado.
 *
 * Cobre:
 *  - 24 combinações de width × height (mobile/tablet/desktop/ultrawide × alturas curtas/médias/altas)
 *  - Listas longas (10 carrinhos × 12 itens) + textos longos (nome/preço grandes)
 *  - Verifica: footer dentro do viewport visível, ScrollArea com overflow real,
 *    scroll funcional, footer permanece ancorado (bbox y constante).
 *  - Snapshots de regressão visual do footer em 4 dimensões âncora.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart, type MockCart } from '../helpers/cart-mock';

test.use({
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
});

const WIDTHS = [320, 360, 375, 414, 540, 768, 1024, 1280, 1440, 1920] as const;
const HEIGHTS = [560, 640, 720, 812, 900, 1080] as const;

// Subconjunto representativo (24 combos) — evita explosão combinatória mas
// cobre todos os pontos críticos onde o footer poderia clipar.
const MATRIX = [
  ...WIDTHS.map((w) => ({ w, h: 560 })), // alturas curtas em todas as larguras
  ...WIDTHS.map((w) => ({ w, h: 720 })),
  ...HEIGHTS.map((h) => ({ w: 375, h })), // mobile em todas alturas
  ...HEIGHTS.map((h) => ({ w: 1280, h })), // desktop em todas alturas
];

function makeLongCart(idx: number): MockCart {
  const base = makeMockCart(idx, 12);
  base.company_name = `Empresa Mock Com Nome Longo Para Stress Test ${idx.toString().padStart(3, '0')}`;
  base.seller_cart_items = base.seller_cart_items.map((it) => ({
    ...it,
    product_name: `Produto ${it.product_name} — descrição longa para forçar wrap e overflow ${idx}`,
    product_price: 9999.99 + idx * 137.13,
    quantity: 999,
  }));
  return base;
}

async function bootstrap(page: Page) {
  await loginAs(page, 'seller');
  await gotoAndSettle(page, '/');
}

async function openWithLongList(page: Page) {
  const carts = Array.from({ length: 10 }, (_, i) => makeLongCart(i));
  await mockSellerCartsAPI(page, carts);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.getByTestId('cart-trigger').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
}

test.describe('Carrinhos · footer nunca corta em matriz de viewports @smoke', () => {
  for (const { w, h } of MATRIX) {
    test(`viewport ${w}x${h} — footer visível e ScrollArea operacional`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await bootstrap(page);
      await openWithLongList(page);

      const drawer = page.getByTestId('cart-drawer');
      const footer = page.getByTestId('cart-popover-footer');
      const scroll = page.getByTestId('cart-popover-scroll');
      const viewport = scroll.locator('[data-radix-scroll-area-viewport]').first();

      await expect(footer).toBeVisible();
      await expect(scroll).toBeVisible();

      // 1) Footer integralmente dentro do viewport da janela (não clipado).
      const fb = await footer.boundingBox();
      expect(fb).not.toBeNull();
      expect(fb!.y).toBeGreaterThanOrEqual(0);
      expect(fb!.y + fb!.height).toBeLessThanOrEqual(h + 1);
      expect(fb!.height).toBeGreaterThan(20); // não colapsou

      // 2) Footer dentro dos limites do drawer (não vazou para fora do popover).
      const db = await drawer.boundingBox();
      expect(db).not.toBeNull();
      expect(fb!.y + fb!.height).toBeLessThanOrEqual(db!.y + db!.height + 1);

      // 3) Footer NÃO está dentro do viewport rolável (= é ancorado).
      const insideScroll = await footer.evaluate(
        (el) => !!el.closest('[data-radix-scroll-area-viewport]'),
      );
      expect(insideScroll).toBe(false);

      // 4) ScrollArea tem overflow real e rola sem mover o footer.
      const metrics = await viewport.evaluate((el) => ({
        sh: el.scrollHeight,
        ch: el.clientHeight,
      }));
      expect(metrics.sh).toBeGreaterThan(metrics.ch);

      await viewport.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
      await page.waitForTimeout(80);
      const fb2 = await footer.boundingBox();
      expect(Math.abs(fb2!.y - fb!.y)).toBeLessThanOrEqual(1);
      await expect(footer).toBeVisible();
    });
  }
});

test.describe('Carrinhos · snapshots âncora do footer', () => {
  for (const vp of [
    { name: 'mobile-375x560', w: 375, h: 560 },
    { name: 'mobile-375x812', w: 375, h: 812 },
    { name: 'desktop-1280x720', w: 1280, h: 720 },
    { name: 'ultrawide-1920x1080', w: 1920, h: 1080 },
  ]) {
    test(`snapshot footer — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await bootstrap(page);
      await openWithLongList(page);
      const footer = page.getByTestId('cart-popover-footer');
      await expect(footer).toBeVisible();
      await expect(footer).toHaveScreenshot(`cart-footer-${vp.name}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});

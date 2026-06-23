/**
 * E2E: popover de carrinhos no header
 *  - garante que, com vários carrinhos, a lista interna rola
 *  - garante que o rodapé "Gerar Orçamento" permanece fixo durante o scroll
 *  - valida comportamento em desktop (1280) e mobile (375) e em 768
 *  - captura snapshots visuais (mobile e desktop) cobrindo scrollbar + footer
 *
 * Estratégia: semeia >=4 carrinhos via localStorage (chave usada pelo CartStore)
 * para garantir overflow vertical sem depender de dados reais do backend.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STORAGE_KEY = 'cart-store-v1';

function makeItem(i: number, n = 3) {
  return Array.from({ length: n }, (_, j) => ({
    id: `item-${i}-${j}`,
    product_id: `prod-${i}-${j}`,
    product_name: `Produto seed ${i}-${j}`,
    product_image_url: null,
    product_price: 19.9 + j,
    quantity: 10 + j,
    color_name: 'Preto',
    color_hex: '#000000',
  }));
}

async function seedCarts(page: Page, count = 6) {
  const carts = Array.from({ length: count }, (_, i) => ({
    id: `seed-cart-${i}`,
    company_id: `co-${i}`,
    company_name: `Empresa seed ${i.toString().padStart(2, '0')}`,
    company_location: 'BR',
    updated_at: new Date().toISOString(),
    items: makeItem(i),
  }));
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ state: { carts: value, activeCartId: value[0]?.id ?? null }, version: 1 }),
      );
    },
    { key: STORAGE_KEY, value: carts },
  );
}

async function openPopover(page: Page) {
  const trigger = page.getByTestId('cart-trigger');
  await trigger.click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
}

test.describe('Carrinhos · popover scroll + footer fixo @smoke', () => {
  for (const vp of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
  ]) {
    test(`${vp.name} (${vp.width}px) — lista rola e rodapé permanece fixo`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginAs(page, 'seller');
      await gotoAndSettle(page, '/');
      await seedCarts(page, 6);
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      await openPopover(page);

      const scroll = page.getByTestId('cart-popover-scroll');
      const footer = page.getByTestId('cart-popover-footer');

      await expect(scroll).toBeVisible();
      await expect(footer).toBeVisible();

      // O viewport interno do Radix ScrollArea recebe data-radix-scroll-area-viewport
      const viewport = scroll.locator('[data-radix-scroll-area-viewport]').first();
      await expect(viewport).toBeVisible();

      // Há overflow real (conteúdo maior que viewport)
      const { scrollHeight, clientHeight } = await viewport.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      expect(scrollHeight).toBeGreaterThan(clientHeight);

      // Snapshot do rodapé antes/depois do scroll: deve permanecer ancorado
      const footerBoxBefore = await footer.boundingBox();
      expect(footerBoxBefore).not.toBeNull();

      await viewport.evaluate((el) => el.scrollTo({ top: 200 }));
      await page.waitForTimeout(120);

      const scrolled = await viewport.evaluate((el) => el.scrollTop);
      expect(scrolled).toBeGreaterThan(0);

      const footerBoxAfter = await footer.boundingBox();
      expect(footerBoxAfter).not.toBeNull();
      // y do footer não muda (rodapé fixo fora do ScrollArea)
      expect(Math.abs((footerBoxAfter!.y ?? 0) - (footerBoxBefore!.y ?? 0))).toBeLessThanOrEqual(1);

      // Visual snapshot do popover (drawer inteiro)
      await expect(page.getByTestId('cart-drawer')).toHaveScreenshot(
        `cart-popover-${vp.name}.png`,
        { animations: 'disabled', maxDiffPixelRatio: 0.02 },
      );
    });
  }
});

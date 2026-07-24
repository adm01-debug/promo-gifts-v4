/**
 * Sidebar sticky + scroll de página + scroll interno do QuoteItemsTable.
 *
 * Sobre `/__visual/quote-view-order` (1280×900):
 *  - `aside` tem `position: sticky` computado com `top ≈ 0`.
 *  - Brand header permanece grudado no topo do viewport após scrollar a página
 *    até o final (Y do brand antes/depois ≤ 2px de diferença).
 *  - Seção "Versões do Orçamento" entra no viewport após o scroll.
 *  - Scroll interno do `QuoteItemsTable` permanece ativo no fixture com 8 itens.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

async function open(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

test('sidebar permanece fixo no viewport ao rolar a página', async ({ page }) => {
  await open(page);

  const aside = page.locator('aside').first();
  await expect(aside).toBeVisible();
  const sticky = await aside.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { position: cs.position, top: cs.top };
  });
  expect(sticky.position).toBe('sticky');
  expect(parseFloat(sticky.top)).toBeLessThanOrEqual(1);

  const brand = page.getByTestId('sidebar-brand-header').first();
  await expect(brand).toBeVisible();
  const before = await brand.boundingBox();
  expect(before).toBeTruthy();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  // espera o sticky reassentar
  await page.waitForFunction(() => window.scrollY > 100, { timeout: 2000 }).catch(() => {});

  const after = await brand.boundingBox();
  expect(after).toBeTruthy();
  expect(
    Math.abs((after!.y) - (before!.y)),
    `brand header se moveu ao rolar: ${before!.y} → ${after!.y}`,
  ).toBeLessThanOrEqual(2);

  await expect(page.getByTestId('harness-quote-versions')).toBeInViewport();
});

test('scroll interno do QuoteItemsTable continua ativo após o ajuste', async ({ page }) => {
  await open(page);
  const scroller = page
    .getByTestId('quote-items-table-fixture-many')
    .getByTestId('quote-items-table-scroll');
  await expect(scroller).toHaveAttribute('data-inner-scroll', 'true');
  const metrics = await scroller.evaluate((el) => ({
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
  }));
  expect(metrics.scrollH).toBeGreaterThan(metrics.clientH);
});

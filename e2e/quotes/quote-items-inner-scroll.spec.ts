/**
 * QuoteItemsTable · scroll interno (>5 itens) e scroll de página.
 *
 * Valida sobre `/__visual/quote-view-order`:
 *  - Fixture `quote-items-table-fixture` (3 itens): scroll interno DESLIGADO.
 *  - Fixture `quote-items-table-fixture-many` (8 itens): scroll interno LIGADO,
 *    `tabIndex=0`, `role=region`, `aria-label`, scrollHeight > clientHeight.
 *  - Página continua rolando até a seção "Versões do Orçamento".
 *  - thead sticky permanece visível enquanto o body rola internamente.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

async function open(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

test('≤5 itens: scroll interno não é ativado', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  const scroller = page
    .getByTestId('quote-items-table-fixture')
    .getByTestId('quote-items-table-scroll');
  await expect(scroller).toHaveAttribute('data-inner-scroll', 'false');
});

test('>5 itens: scroll interno ativo, a11y e thead sticky', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);

  const scroller = page
    .getByTestId('quote-items-table-fixture-many')
    .getByTestId('quote-items-table-scroll');
  await expect(scroller).toBeVisible();
  await expect(scroller).toHaveAttribute('data-inner-scroll', 'true');
  await expect(scroller).toHaveAttribute('role', 'region');
  await expect(scroller).toHaveAttribute('tabindex', '0');
  await expect(scroller).toHaveAttribute('aria-label', /rolável de 8 itens/);

  const metrics = await scroller.evaluate((el) => ({
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
  }));
  expect(metrics.scrollH).toBeGreaterThan(metrics.clientH);

  // Estado inicial: topo da rolagem interna.
  await expect(scroller).toHaveAttribute('data-scroll-at-top', 'true');

  // Rola internamente e confirma que o thead sticky se mantém no topo do
  // container (mesma Y do scroller após o scroll).
  const thead = scroller.locator('thead').first();
  const headBefore = await thead.boundingBox();
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(scroller).toHaveAttribute('data-scroll-at-bottom', 'true');
  const headAfter = await thead.boundingBox();
  const scrollerBox = await scroller.boundingBox();
  expect(headBefore && headAfter && scrollerBox).toBeTruthy();
  // Header sticky: top do thead permanece colado ao top do scroller (±2px).
  expect(Math.abs((headAfter!.y) - scrollerBox!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs((headAfter!.y) - (headBefore!.y))).toBeLessThanOrEqual(2);
});

test('página continua rolando até "Versões do Orçamento"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  const versions = page.getByTestId('harness-quote-versions');
  await versions.scrollIntoViewIfNeeded();
  await expect(versions).toBeInViewport();
});

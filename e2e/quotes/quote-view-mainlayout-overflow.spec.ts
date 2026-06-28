/**
 * MainLayout root MUST use `overflow-x: clip` (não `hidden`) e <html>/<body>
 * devem permanecer `visible`. `overflow-x: hidden` promove `overflow-y` para
 * `auto` (CSS spec), criando scroll container que ANULA o sticky da `<aside>`.
 *
 * Esta spec roda em chromium/firefox/webkit para garantir consistência.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

async function open(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

test('@smoke MainLayout root e html/body NÃO usam overflow-x:hidden', async ({ page }) => {
  await open(page);
  const styles = await page.evaluate(() => {
    const root = document.querySelector('[role="document"]') as HTMLElement | null;
    return {
      html: getComputedStyle(document.documentElement).overflowX,
      body: getComputedStyle(document.body).overflowX,
      mainLayout: root ? getComputedStyle(root).overflowX : null,
      hasRoot: !!root,
    };
  });
  expect(styles.hasRoot, 'MainLayout [role="document"] não encontrado').toBe(true);
  for (const [scope, value] of Object.entries({
    html: styles.html,
    body: styles.body,
    mainLayout: styles.mainLayout,
  })) {
    expect(value, `${scope} overflow-x=${value} quebra sticky da sidebar`).not.toBe('hidden');
    expect(['visible', 'clip'], `${scope} overflow-x deve ser visible|clip, veio ${value}`).toContain(value);
  }
});

test('sticky do aside continua ativo após rolar o conteúdo', async ({ page }) => {
  await open(page);
  const aside = page.locator('aside').first();
  const brand = page.getByTestId('sidebar-brand-header').first();
  const before = await brand.boundingBox();
  expect(before).toBeTruthy();
  await page.mouse.wheel(0, 4000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const after = await brand.boundingBox();
  expect(after).toBeTruthy();
  expect(await aside.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
  expect(
    Math.abs(after!.y - before!.y),
    `brand moveu ${before!.y} → ${after!.y}`,
  ).toBeLessThanOrEqual(2);
});

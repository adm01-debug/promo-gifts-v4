/**
 * Sticky do <aside> validado em mobile/tablet/desktop e após resize dinâmico.
 * Também executa a guarda de overflow-x (html/body/MainLayout != hidden) a cada
 * navegação/resize — falha o build se qualquer um voltar a `overflow-x: hidden`.
 *
 * Inclui um ciclo de estresse (scroll + resize) com esperas determinísticas
 * (rAF dupla + ResizeObserver + scroll settle) para evitar flakiness.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

type VP = { name: string; width: number; height: number };
const VIEWPORTS: VP[] = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'desktop-xl', width: 1680, height: 1050 },
];

/**
 * Aguarda o layout estabilizar após resize:
 *  1) window.innerWidth bate com o alvo (viewport propagou)
 *  2) dois rAFs consecutivos sem mudança de dimensão do <aside> (ou ausência dele)
 *  3) scroll parou de mudar entre frames
 */
async function waitLayoutSettled(page: Page, expectedWidth: number, timeout = 2000) {
  await page
    .waitForFunction((w) => window.innerWidth === w, expectedWidth, { timeout })
    .catch(() => {});
  await page
    .waitForFunction(
      () =>
        new Promise<boolean>((resolve) => {
          const aside = document.querySelector('aside');
          let prev = aside
            ? `${aside.getBoundingClientRect().width}x${aside.getBoundingClientRect().height}`
            : 'none';
          let prevScroll = window.scrollY;
          let stableFrames = 0;
          const tick = () => {
            const a = document.querySelector('aside');
            const cur = a
              ? `${a.getBoundingClientRect().width}x${a.getBoundingClientRect().height}`
              : 'none';
            const sc = window.scrollY;
            if (cur === prev && sc === prevScroll) stableFrames++;
            else stableFrames = 0;
            prev = cur;
            prevScroll = sc;
            if (stableFrames >= 2) resolve(true);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      null,
      { timeout },
    )
    .catch(() => {});
}

async function assertNoOverflowXHidden(page: Page, scope: string) {
  const styles = await page.evaluate(() => {
    const root = document.querySelector('[role="document"]') as HTMLElement | null;
    return {
      html: getComputedStyle(document.documentElement).overflowX,
      body: getComputedStyle(document.body).overflowX,
      mainLayout: root ? getComputedStyle(root).overflowX : null,
    };
  });
  for (const [k, v] of Object.entries(styles)) {
    expect(v, `[${scope}] ${k} overflow-x=${v} (esperado clip|visible)`).not.toBe('hidden');
    if (v !== null) expect(['visible', 'clip'], `[${scope}] ${k}=${v}`).toContain(v);
  }
}

async function assertStickyAside(page: Page, scope: string) {
  const aside = page.locator('aside').first();
  if ((await aside.count()) === 0) return;
  const visible = await aside.isVisible().catch(() => false);
  if (!visible) return;
  const pos = await aside.evaluate((el) => getComputedStyle(el).position);
  expect(pos, `[${scope}] aside position=${pos}`).toBe('sticky');

  const brand = page.getByTestId('sidebar-brand-header').first();
  if ((await brand.count()) === 0) return;
  const before = await brand.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page
    .waitForFunction(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return Math.abs(window.scrollY - max) <= 2 || window.scrollY > 50;
    }, null, { timeout: 1500 })
    .catch(() => {});
  const after = await brand.boundingBox();
  if (before && after) {
    expect(
      Math.abs(after.y - before.y),
      `[${scope}] brand moveu ${before.y} → ${after.y}`,
    ).toBeLessThanOrEqual(2);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 1000 }).catch(() => {});
}

for (const vp of VIEWPORTS) {
  test(`@smoke sticky + overflow-x guard @ ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
    await waitLayoutSettled(page, vp.width);
    await assertNoOverflowXHidden(page, `nav:${vp.name}`);
    await assertStickyAside(page, vp.name);
  });
}

test('sticky preservado após resize dinâmico (mobile → tablet → desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await waitLayoutSettled(page, vp.width);
    await assertNoOverflowXHidden(page, `resize:${vp.name}`);
    await assertStickyAside(page, `resize:${vp.name}`);
  }
});

test('estresse: centenas de ciclos de scroll + resize sem quebrar sticky', async ({ page }, testInfo) => {
  testInfo.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();

  const cycles = process.env.CI ? 200 : 60;
  const widths = [390, 834, 1280, 1680];

  for (let i = 0; i < cycles; i++) {
    const w = widths[i % widths.length];
    await page.setViewportSize({ width: w, height: 900 });
    // Esperar layout assentar ANTES de mexer no scroll, evitando medir mid-reflow.
    await waitLayoutSettled(page, w, 1500);

    const targetY = (i * 137) % 2000;
    await page.evaluate((y) => window.scrollTo(0, y), targetY);
    // Aguarda o scroll efetivar (Y atingido ou clamp pelo documento) + 1 rAF.
    await page
      .waitForFunction(
        (y) => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          const want = Math.min(y, Math.max(0, max));
          return Math.abs(window.scrollY - want) <= 1;
        },
        targetY,
        { timeout: 1000 },
      )
      .catch(() => {});
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    );

    if (i % 25 === 0) {
      await assertNoOverflowXHidden(page, `stress#${i}`);
      const aside = page.locator('aside').first();
      if (await aside.isVisible().catch(() => false)) {
        const pos = await aside.evaluate((el) => getComputedStyle(el).position);
        expect(pos, `ciclo ${i} (w=${w}) aside position=${pos}`).toBe('sticky');
      }
    }
  }
});

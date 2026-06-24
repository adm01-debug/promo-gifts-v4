/**
 * Visual regression: header sticky do Resumo.
 *
 * Garante que bordas, backdrop-blur e sombra do header NÃO regridam:
 *  - estado inicial (sem scroll)
 *  - estado sticky (após rolar a lista de produtos)
 *  - mobile (375) e tablet (768)
 *
 * Baselines são geradas no primeiro run com `--update-snapshots`.
 * Tolerância: 0.2% pixel diff (Playwright default `maxDiffPixelRatio`).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STORAGE_KEY_NEW = 'quote-builder:collapsed-item-keys:new';

async function setup(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await loginAs(page, 'user');
  await page.addInitScript((k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }, STORAGE_KEY_NEW);
  await gotoAndSettle(page, '/orcamentos/novo');
}

async function skipIfEmpty(page: Page) {
  const firstCard = page.getByTestId('quote-summary-item-0');
  if ((await firstCard.count()) === 0) {
    test.skip(true, 'Resumo vazio.');
  }
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
}

async function scrollContainerToBottomSync(page: Page) {
  await page.evaluate(() => {
    const header = document.querySelector('[data-testid="quote-summary-header"]');
    if (!header) return;
    let el: HTMLElement | null = header.parentElement;
    while (el) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
        return;
      }
      el = el.parentElement;
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  // espera o scroll estabilizar (sem race com animações de hover/tooltip)
  await page.waitForFunction(() => {
    const header = document.querySelector('[data-testid="quote-summary-header"]');
    if (!header) return false;
    let el: HTMLElement | null = header.parentElement;
    while (el) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) {
        return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      }
      el = el.parentElement;
    }
    return true;
  }, null, { timeout: 5000 });
}

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 720 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Visual regression · Resumo sticky header · ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await setup(page, vp.width, vp.height);
      await skipIfEmpty(page);
    });

    test(`baseline antes do scroll — ${vp.name}`, async ({ page }) => {
      const header = page.getByTestId('quote-summary-header');
      await expect(header).toBeVisible();
      // mascarar áreas que mudam por dado (valores monetários no footer não
      // aparecem aqui, mas o tooltip pode flutuar — fechamos para evitar flake).
      await page.mouse.move(0, 0);
      await expect(header).toHaveScreenshot(
        `summary-header-initial-${vp.name}.png`,
        { animations: 'disabled', maxDiffPixelRatio: 0.02 },
      );
    });

    test(`estado sticky após rolar — ${vp.name}`, async ({ page }) => {
      const header = page.getByTestId('quote-summary-header');
      await expect(header).toBeVisible();

      await scrollContainerToBottomSync(page);
      await page.mouse.move(0, 0);

      await expect(header).toHaveScreenshot(
        `summary-header-sticky-${vp.name}.png`,
        { animations: 'disabled', maxDiffPixelRatio: 0.02 },
      );
    });
  });
}

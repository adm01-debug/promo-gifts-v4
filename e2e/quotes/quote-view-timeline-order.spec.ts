/**
 * QuoteViewPage · disposição timeline → header → container.
 *
 * Roda sobre o harness `/__visual/quote-view-order` (espelho 1:1 do
 * `QuoteViewPage`), eliminando dependência de seed/auth. Cobre:
 *   1. Ordem DOM (timeline antes do h1).
 *   2. Geometria: timeline.bottom ≤ h1.top; h1.bottom ≤ container.top.
 *   3. Mobile 375 — sem sobreposição header×container ao rolar.
 *   4. Snapshots visuais light/dark.
 *   5. axe-core no dark sobre a QuoteStatusTimeline (contraste real).
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoAndSettle } from '../helpers/nav';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ROUTE = '/__visual/quote-view-order';

const DEFAULT_RATIO = Number(process.env.VISUAL_THRESHOLD_DEFAULT ?? '0.02');
function ratio(envKey: string): number {
  const v = process.env[envKey];
  return v === undefined || v === '' ? DEFAULT_RATIO : Number(v);
}
const snapOpts = (envKey: string) => ({
  animations: 'disabled' as const,
  maxDiffPixelRatio: ratio(envKey),
});

function dumpAxe(name: string, payload: unknown) {
  const path = `test-results/axe/${name}.json`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2));
}

async function go(page: Page, theme: 'light' | 'dark') {
  await gotoAndSettle(page, theme === 'dark' ? `${ROUTE}?theme=dark` : ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
  await expect(page.getByTestId('quote-status-timeline')).toBeVisible();
  await expect(page.getByTestId('page-title-quote-view')).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`QuoteViewPage · disposição (${theme})`, () => {
    test(`ordem DOM e geometria — ${theme}`, async ({ page }) => {
      await go(page, theme);

      const order = await page.evaluate(() => {
        const tl = document.querySelector('[data-testid="quote-status-timeline"]');
        const h1 = document.querySelector('[data-testid="page-title-quote-view"]');
        if (!tl || !h1) return false;
        return Boolean(tl.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(order, 'QuoteStatusTimeline deve preceder o h1 do header').toBe(true);

      const boxes = await page.evaluate(() => {
        const tl = document
          .querySelector('[data-testid="quote-status-timeline"]')!
          .getBoundingClientRect();
        const h1 = document
          .querySelector('[data-testid="page-title-quote-view"]')!
          .getBoundingClientRect();
        const card = document
          .querySelector('[data-testid="quote-content-card"]')!
          .getBoundingClientRect();
        return {
          tlBottom: tl.bottom,
          h1Top: h1.top,
          h1Bottom: h1.bottom,
          cardTop: card.top,
        };
      });
      expect(boxes.tlBottom).toBeLessThanOrEqual(boxes.h1Top + 1);
      expect(boxes.h1Bottom).toBeLessThanOrEqual(boxes.cardTop + 1);
    });

    test(`mobile 375 — sem sobreposição ao rolar — ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 720 });
      await go(page, theme);

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForFunction(
        () =>
          Math.abs(window.scrollY + window.innerHeight - document.body.scrollHeight) < 4,
        null,
        { timeout: 3000 },
      );

      const overlap = await page.evaluate(() => {
        const h1 = document
          .querySelector('[data-testid="page-title-quote-view"]')!
          .getBoundingClientRect();
        const card = document
          .querySelector('[data-testid="quote-content-card"]')!
          .getBoundingClientRect();
        const horiz = h1.left < card.right && h1.right > card.left;
        const vert = h1.top < card.bottom && h1.bottom > card.top;
        return horiz && vert;
      });
      expect(overlap, 'Header não deve sobrepor o container do orçamento').toBe(false);
    });

    test(`snapshot visual — ${theme}`, async ({ page }) => {
      await go(page, theme);
      await page.mouse.move(0, 0);
      await expect(page.getByTestId('quote-view-order-harness')).toHaveScreenshot(
        `quote-view-order-${theme}.png`,
        snapOpts(`VISUAL_THRESHOLD_QUOTE_VIEW_ORDER_${theme.toUpperCase()}`),
      );
    });
  });
}

test.describe('QuoteStatusTimeline · acessibilidade (dark)', () => {
  test('axe-core WCAG 2.1 AA — contraste em fundo preto', async ({ page }) => {
    await go(page, 'dark');

    const results = await new AxeBuilder({ page })
      .include('[data-testid="quote-status-timeline"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .withRules(['color-contrast'])
      .analyze();

    dumpAxe('quote-status-timeline-dark', results);

    expect(
      results.violations,
      `Violações em QuoteStatusTimeline (dark): ${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });
});

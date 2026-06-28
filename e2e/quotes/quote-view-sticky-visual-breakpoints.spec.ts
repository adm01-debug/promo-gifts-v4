/**
 * Visual regression do layout com sidebar fixa em múltiplos breakpoints,
 * antes e depois do scroll, em tema light e (quando disponível) dark.
 *
 * Para gerar baselines (uma vez por project):
 *   npx playwright test e2e/quotes/quote-view-sticky-visual-breakpoints.spec.ts \
 *     --project=chromium-public --update-snapshots
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

const BREAKPOINTS = [
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'desktop-xl', width: 1680, height: 1050 },
] as const;

const THEMES = ['light', 'dark'] as const;

const SNAP = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixelRatio: 0.025,
  threshold: 0.2,
  scale: 'css' as const,
};

test.use({ reducedMotion: 'reduce' });

async function applyTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(t);
    try {
      localStorage.setItem('theme', t);
    } catch {}
  }, theme);
}

for (const bp of BREAKPOINTS) {
  for (const theme of THEMES) {
    test.describe(`@visual sticky ${bp.name} / ${theme}`, () => {
      test.use({ viewport: { width: bp.width, height: bp.height } });

      test.beforeEach(async ({ page }) => {
        await gotoAndSettle(page, ROUTE);
        await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
        await applyTheme(page, theme);
        await page.evaluate(
          () => document.fonts && (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready,
        );
      });

      test('sidebar antes do scroll', async ({ page }) => {
        const aside = page.locator('aside').first();
        await expect(aside).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => window.scrollY === 0);
        await expect(aside).toHaveScreenshot(`sidebar-${bp.name}-${theme}-before.png`, SNAP);
      });

      test('sidebar depois do scroll', async ({ page }) => {
        const aside = page.locator('aside').first();
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForFunction(() => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          return Math.abs(window.scrollY - max) <= 2;
        });
        await expect(page.getByTestId('harness-quote-versions')).toBeInViewport();
        await expect(aside).toHaveScreenshot(`sidebar-${bp.name}-${theme}-after.png`, SNAP);
      });
    });
  }
}

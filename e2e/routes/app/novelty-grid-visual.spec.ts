import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const viewports = [
  { width: 360, height: 800, name: 'mobile-360' },
  { width: 768, height: 1024, name: 'tablet-768' },
  { width: 1024, height: 768, name: 'tablet-1024' },
  { width: 1440, height: 900, name: 'desktop-1440' },
];

test.describe('Novelty Grid Advanced Visual & A11y @mobile', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      const defaultFlags = {
        mfa: 'false',
        ai_recommendations: 'true',
        presentation_mode: 'true',
        voice_commands: 'true',
        magic_up: 'true',
        e2e_tests: 'true',
        advanced_analytics: 'true',
        custom_kits_v2: 'false',
      };
      Object.entries(defaultFlags).forEach(([flag, value]) => {
        localStorage.setItem(`ff_${flag}`, value);
      });
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const r of regs) r.unregister();
        });
      }
    });
  });

  for (const viewport of viewports) {
    test.describe(`Viewport: ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('Header immediate rendering', async ({ page }) => {
        await page.goto('/novidades', { waitUntil: 'domcontentloaded' });
        const title = page.locator('[data-testid="page-title-novidades"]');
        const desc = page.locator('[data-testid="novelty-description"]');
        await expect(title).toBeVisible();
        await expect(title).toHaveText('Novidades');
        await expect(desc).toHaveText(
          'Produtos recém-chegados ao catálogo nos últimos 30 dias',
        );
      });

      test('Grid responsive columns & scroll alignment', async ({ page }) => {
        await page.goto('/novidades');
        const grid = page.locator('div[role="list"][aria-label="Grade de novidades"]');
        await grid.waitFor({ state: 'visible' });
        await page.waitForTimeout(800);

        await expect(grid).toHaveScreenshot(`novelty-grid-initial-${viewport.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });

        await grid.evaluate((el) => (el.scrollTop = 1000));
        await page.waitForTimeout(600);

        await expect(grid).toHaveScreenshot(`novelty-grid-scrolled-${viewport.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });
      });

      test('Accessibility scan', async ({ page }) => {
        await page.goto('/novidades');
        const grid = page.locator('div[role="list"][aria-label="Grade de novidades"]');
        await grid.waitFor({ state: 'visible' });

        const results = await new AxeBuilder({ page })
          .include('div[role="list"][aria-label="Grade de novidades"]')
          .analyze();
        expect(results.violations).toEqual([]);
      });
    });
  }

  test('Card alignment edge cases (title + price min-heights)', async ({ page }) => {
    await page.goto('/novidades');
    const cards = page.locator('div[role="listitem"]');
    await cards.first().waitFor();

    const allCards = await cards.all();
    for (const card of allCards.slice(0, 3)) {
      const h3 = card.locator('h3');
      const h3Box = await h3.boundingBox();
      if (h3Box) expect(h3Box.height).toBeGreaterThanOrEqual(40);
    }
  });
});

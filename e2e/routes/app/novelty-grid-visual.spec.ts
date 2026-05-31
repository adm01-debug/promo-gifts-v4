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
        'mfa': 'false',
        'ai_recommendations': 'true',
        'presentation_mode': 'true',
        'voice_commands': 'true',
        'magic_up': 'true',
        'e2e_tests': 'true', 
        'advanced_analytics': 'true',
        'custom_kits_v2': 'false'
      };
      
      Object.entries(defaultFlags).forEach(([flag, value]) => {
        localStorage.setItem(`ff_${flag}`, value);
      });

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    });
  });

  for (const viewport of viewports) {
    test.describe(`Viewport: ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('Header Immediate Rendering & Visual', async ({ page }) => {
        await page.goto('/novidades', { waitUntil: 'domcontentloaded' });
        
        const header = page.locator('div.flex.flex-col.gap-4').first();
        const title = header.locator('[data-testid="page-title-novidades"]');
        const desc = header.locator('[data-testid="novelty-description"]');
        
        await expect(title).toBeVisible();
        await expect(title).toHaveText('Novidades');
        await expect(desc).toHaveText('Produtos recém-chegados ao catálogo nos últimos 30 dias');
        
        await expect(header).toHaveScreenshot(`novelty-header-only-${viewport.name}.png`);
      });

      test('Grid Visual Regression & Scroll', async ({ page }) => {
        await page.goto('/novidades');
        const grid = page.locator('div[role="list"]');
        await grid.waitFor({ state: 'visible' });
        await page.waitForTimeout(1000);

        await expect(grid).toHaveScreenshot(`novelty-grid-initial-${viewport.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });

        await grid.evaluate(el => el.scrollTop = 1000);
        await page.waitForTimeout(800);
        
        await expect(grid).toHaveScreenshot(`novelty-grid-scrolled-${viewport.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });
      });

      test('Accessibility Scan', async ({ page }) => {
        await page.goto('/novidades');
        const grid = page.locator('div[role="list"]');
        await grid.waitFor({ state: 'visible' });

        const results = await new AxeBuilder({ page })
          .include('div[role="list"]')
          .analyze();
        
        expect(results.violations).toEqual([]);
      });

      test('Keyboard Navigation', async ({ page }) => {
        await page.goto('/novidades');
        await page.keyboard.press('Tab');
        
        const activeElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(activeElement).toBeDefined();
        
        await page.keyboard.press('Tab');
        await expect(page).toHaveScreenshot(`novelty-keyboard-focus-${viewport.name}.png`);
      });
    });
  }

  test('Card Consistency Check', async ({ page }) => {
    await page.goto('/novidades');
    const cards = page.locator('div[role="listitem"]');
    await cards.first().waitFor();

    const allCards = await cards.all();
    for (const card of allCards.slice(0, 3)) {
      const h3 = card.locator('h3');
      const priceContainer = card.locator('.min-h-\\[3\\.25rem\\]'); 
      
      const h3Box = await h3.boundingBox();
      const priceBox = await priceContainer.boundingBox();

      if (h3Box) expect(h3Box.height).toBeGreaterThanOrEqual(40); 
      if (priceBox) expect(priceBox.height).toBeGreaterThanOrEqual(52); 
    }
  });
});

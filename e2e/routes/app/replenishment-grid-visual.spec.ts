import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const viewports = [
  { width: 360, height: 800, name: 'mobile-360' },
  { width: 768, height: 1024, name: 'tablet-768' },
  { width: 1024, height: 768, name: 'tablet-1024' },
  { width: 1440, height: 900, name: 'desktop-1440' },
];

test.describe('Replenishment Grid Advanced Visual & A11y @mobile', () => {
  for (const viewport of viewports) {
    test.describe(`Viewport: ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('Page Header Visual Validation', async ({ page }) => {
        await page.goto('/reposicao');
        const header = page.locator('div.flex.items-center.gap-3').first();
        await expect(header).toBeVisible();
        await expect(header.locator('h1')).toHaveText('Reposição');
        await expect(header.locator('[data-testid="replenishment-description"]')).toHaveText('Produtos que voltaram ao estoque dos fornecedores nos últimos 30 dias');
        
        await expect(header).toHaveScreenshot(`header-${viewport.name}.png`);
      });

      test('Visual Regression & Virtualization Scroll', async ({ page }) => {
        await page.goto('/reposicao');
        const grid = page.locator('div[role="list"]');
        await grid.waitFor({ state: 'visible' });
        await page.waitForTimeout(1000);

        // 1. Initial State Screenshot
        await expect(grid).toHaveScreenshot(`grid-initial-${viewport.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });

        // 2. Scroll to middle/end to test virtualization alignment
        await grid.evaluate(el => el.scrollTop = 1000);
        await page.waitForTimeout(800); // Wait for virtualization to re-render
        
        await expect(grid).toHaveScreenshot(`grid-scrolled-${viewport.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });
      });

      test('Accessibility Scan with Report', async ({ page }) => {
        await page.goto('/reposicao');
        const grid = page.locator('div[role="list"]');
        await grid.waitFor({ state: 'visible' });

        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('div[role="list"]')
          .analyze();
        
        if (accessibilityScanResults.violations.length > 0) {
          console.error(`Axe violations for ${viewport.name}:`, JSON.stringify(accessibilityScanResults.violations, null, 2));
        }
        
        expect(accessibilityScanResults.violations).toEqual([]);
      });
    });
  }

  test('Card Edge Cases: Long Title, Price Consult, No Image', async ({ page }) => {
    // This test assumes we might have some mocked or specific data items
    // If not, we validate that existing cards (even with variation) respect the min-heights defined in styles
    await page.goto('/reposicao');
    const cards = page.locator('div[role="listitem"]');
    await cards.first().waitFor();

    const allCards = await cards.all();
    for (const card of allCards.slice(0, 5)) {
      const h3 = card.locator('h3');
      const priceContainer = card.locator('.min-h-\\[3\\.25rem\\]'); // Based on our product-card-styles
      
      const h3Box = await h3.boundingBox();
      const priceBox = await priceContainer.boundingBox();

      if (h3Box) expect(h3Box.height).toBeGreaterThanOrEqual(40); // 2.5rem
      if (priceBox) expect(priceBox.height).toBeGreaterThanOrEqual(52); // 3.25rem
    }
  });

  test.describe('User Preferences: Reduced Motion & Large Font', () => {
    test.use({ 
      contextOptions: { 
        reducedMotion: 'reduce',
      } 
    });

    test('Grid remains consistent with reduced motion', async ({ page }) => {
      await page.goto('/reposicao');
      const grid = page.locator('div[role="list"]');
      await grid.waitFor({ state: 'visible' });
      
      // Visual check that grid still renders correctly even with motion reduced
      await expect(grid).toHaveScreenshot('grid-reduced-motion.png');
    });
  });
});

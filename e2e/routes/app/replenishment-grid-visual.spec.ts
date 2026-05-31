import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const viewports = [
  { width: 360, height: 800, name: 'mobile-360' },
  { width: 768, height: 1024, name: 'tablet-768' },
  { width: 1024, height: 768, name: 'tablet-1024' },
  { width: 1440, height: 900, name: 'desktop-1440' },
];

test.describe('Replenishment Grid Advanced Visual & A11y @mobile', () => {
  test.beforeEach(async ({ context }) => {
    // Hard cleaning of cache and service workers
    await context.addInitScript(() => {
      // Force default feature flags to ensure consistency
      const defaultFlags = {
        'mfa': 'false',
        'ai_recommendations': 'true',
        'presentation_mode': 'true',
        'voice_commands': 'true',
        'magic_up': 'true',
        'e2e_tests': 'true', // enable for tests
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

      test('Immediate Header Rendering (No Delay)', async ({ page }) => {
        // Navigate with no cache and wait for DOMContentLoaded (fastest point)
        await page.goto('/reposicao', { waitUntil: 'domcontentloaded' });
        
        const header = page.locator('div.flex.items-center.gap-4').first();
        const title = header.locator('[data-testid="page-title-reposicao"]');
        const desc = header.locator('[data-testid="replenishment-description"]');
        
        // Should be present in DOM almost immediately
        await expect(title).toBeVisible({ timeout: 5000 });
        await expect(title).toHaveText('Reposição');
        await expect(desc).toHaveText('Produtos que voltaram ao estoque dos fornecedores nos últimos 30 dias');
      });

      test('Loading State Visual Validation', async ({ page }) => {
        // Simulate slow network to see the skeleton
        await page.route('**/replenishments**', async route => {
          await new Promise(resolve => setTimeout(resolve, 3000));
          await route.continue();
        });
        
        await page.goto('/reposicao');
        
        // Take screenshot of the page while data is loading (showing skeletons)
        await expect(page).toHaveScreenshot(`loading-state-${viewport.name}.png`, {
          mask: [page.locator('[data-testid="replenishment-description"]')], // ensure we ignore the text if it's already there
        });
      });


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

        const header = page.locator('div.flex.items-center.gap-4').first();
        await expect(header).toHaveScreenshot(`header-only-${viewport.name}.png`);
        
        // 2. Initial State Screenshot (FOCUSED ON GRID as requested earlier)
        await expect(grid).toHaveScreenshot(`grid-initial-${viewport.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });

        // 3. Scroll to middle/end to test virtualization alignment
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
      test('Keyboard Navigation Flow', async ({ page }) => {
        await page.goto('/reposicao');
        await page.keyboard.press('Tab');
        
        // We expect focus to reach the search input or first interactive element
        const activeElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(activeElement).toBeDefined();
        
        // Navigate through the toolbar
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Take a screenshot of the focus state if possible
        await expect(page).toHaveScreenshot(`keyboard-focus-${viewport.name}.png`);
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

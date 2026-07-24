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
    // Regressão visual autenticada: requer login real (E2E_USER_*) e baselines
    // commitados. Sem credenciais (full-ci / visual-tests sem secrets) pula
    // limpo em vez de falhar — espelha requireAuth() do test-base.
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      'E2E_USER_EMAIL/PASSWORD não configurados — baseline visual autenticada indisponível',
    );
    // Hard cleaning of cache and service workers
    await context.addInitScript(() => {
      // Force default feature flags to ensure consistency
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
        await page.goto('/reposicao', { waitUntil: 'domcontentloaded' });
        
        const header = page.locator('div.flex.flex-col.gap-4').first();
        const title = header.locator('[data-testid="page-title-reposicao"]');
        const desc = header.locator('[data-testid="replenishment-description"]');
        
        // Immediate presence check
        await expect(title).toBeVisible();
        await expect(title).toHaveText('Reposição');
        await expect(desc).toHaveText('Produtos que voltaram ao estoque dos fornecedores nos últimos 30 dias');
        
        // Visual regression for header only
        await expect(header).toHaveScreenshot(`header-only-${viewport.name}.png`);
      });

      test('Loading State Skeletons', async ({ page }) => {
        // Block replenishments data to keep skeletons visible
        await page.route('**/replenishments**', async route => {
          await new Promise(resolve => setTimeout(resolve, 5000));
          await route.continue();
        });
        
        await page.goto('/reposicao');
        
        // Wait for the initial layout but before data fills
        const statsSkeleton = page.locator('div[aria-label="Carregando estatísticas"]');
        await expect(statsSkeleton).toBeVisible();
        
        await expect(page).toHaveScreenshot(`loading-state-${viewport.name}.png`);
      });

      test('Grid Visual Regression & Scroll', async ({ page }) => {
        await page.goto('/reposicao');
        const grid = page.locator('div[role="list"]');
        await grid.waitFor({ state: 'visible' });
        await page.waitForTimeout(1000);

        // Initial Grid State
        await expect(grid).toHaveScreenshot(`grid-initial-${viewport.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });

        // Virtualization Scroll Alignment
        await grid.evaluate(el => el.scrollTop = 1000);
        await page.waitForTimeout(800);
        
        await expect(grid).toHaveScreenshot(`grid-scrolled-${viewport.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });
      });

      test('Accessibility Scan', async ({ page }) => {
        await page.goto('/reposicao');
        const grid = page.locator('div[role="list"]');
        await grid.waitFor({ state: 'visible' });

        const results = await new AxeBuilder({ page })
          .include('div[role="list"]')
          .analyze();
        
        expect(results.violations).toEqual([]);
      });

      test('Keyboard Navigation', async ({ page }) => {
        await page.goto('/reposicao');
        await page.keyboard.press('Tab');
        
        const activeElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(activeElement).toBeDefined();
        
        await page.keyboard.press('Tab');
        await expect(page).toHaveScreenshot(`keyboard-focus-${viewport.name}.png`);
      });
    });
  }

  test('Card Edge Cases', async ({ page }) => {
    await page.goto('/reposicao');
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

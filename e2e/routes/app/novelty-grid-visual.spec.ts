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
    // Regressão visual autenticada: requer login real (E2E_USER_*) e baselines
    // commitados. Sem credenciais (full-ci / visual-tests sem secrets) pula
    // limpo em vez de falhar — espelha requireAuth() do test-base.
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      'E2E_USER_EMAIL/PASSWORD não configurados — baseline visual autenticada indisponível',
    );
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
        await expect(desc).toHaveText(
          'Produtos recém-chegados, destacados como novidade pelos fornecedores',
        );

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

        if (results.violations.length > 0) {
          console.error(`A11y Violations for viewport ${viewport.name}:`);
          results.violations.forEach(v => {
            console.error(`- [${v.id}] ${v.help} (${v.impact})`);
            console.error(`  URL: ${v.helpUrl}`);
            console.error(`  Nodes: ${v.nodes.length}`);
          });
        }

        expect(results.violations, `A11y violations found in ${viewport.name}: ${results.violations.map(v => v.id).join(', ')}`).toEqual([]);
      });

      test('Browser Preferences - Accessibility Consistency', async ({ page }) => {
        await page.addStyleTag({
          content: `
            html { font-size: 20px !important; }
            * { transition: none !important; animation: none !important; }
          `
        });

        await page.goto('/novidades');
        const grid = page.locator('div[role="list"]');
        await grid.waitFor({ state: 'visible' });

        await expect(grid).toHaveScreenshot(`novelty-grid-a11y-prefs-${viewport.name}.png`);
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

  test('Skeleton State & Layout Stability', async ({ page }) => {
    await page.route('**/api/external-db', async route => {
      if (route.request().postDataJSON()?.operation === 'select') {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      await route.continue();
    });

    await page.goto('/novidades');
    const skeleton = page.locator('.animate-spin').first();
    await expect(skeleton).toBeVisible();

    const grid = page.locator('div.grid').filter({ has: page.locator('.animate-pulse') }).first();
    await expect(grid).toHaveScreenshot('novelty-skeleton-state.png');

    await page.waitForSelector('div[role="list"]');
    const realGrid = page.locator('div[role="list"]');
    await expect(realGrid).toBeVisible();
    await expect(realGrid).toHaveScreenshot('novelty-data-loaded-stability.png');
  });

  test('Pagination & Alignment Check', async ({ page }) => {
    await page.route('**/api/external-db', async route => {
      const body = route.request().postDataJSON();
      if (body?.operation === 'select' && body?.table === 'products') {
        const mockProducts = Array.from({ length: 45 }, (_, i) => ({
          id: `page-mock-${i}`,
          name: `Product ${i} ${i % 3 === 0 ? 'with a very very very long name to test wrapping and alignment consistency across the grid' : ''}`,
          sku: `SKU-${i}`,
          primary_image_url: null,
          sale_price: i % 5 === 0 ? null : 100 + i,
          category_id: 'cat-1',
          supplier_id: 'sup-1',
          created_at: new Date().toISOString(),
          stock_quantity: 100,
          min_quantity: 10
        }));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ records: mockProducts, count: 45 })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/novidades');
    const paginator = page.locator('nav[aria-label="pagination"]');
    await paginator.waitFor();

    const firstPageItems = page.locator('div[role="listitem"]');
    await expect(firstPageItems).toHaveCount(20);
    await expect(page).toHaveScreenshot('novelty-pagination-page-1.png');

    await page.click('a[aria-label="Go to next page"]');
    await page.waitForTimeout(500);
    await expect(page.locator('div[role="listitem"]')).toHaveCount(20);
    await expect(page).toHaveScreenshot('novelty-pagination-page-2.png');

    await page.click('a:text("3")');
    await page.waitForTimeout(500);
    await expect(page.locator('div[role="listitem"]')).toHaveCount(5);
    await expect(page).toHaveScreenshot('novelty-pagination-last-page.png');
  });

  test('Card Variations: Long Title & Consultation Price', async ({ page }) => {
    await page.route('**/api/external-db', async route => {
      const body = route.request().postDataJSON();
      if (body?.operation === 'select' && body?.table === 'products') {
        const mockProducts = [
          {
            id: 'var-1',
            name: 'Short Title',
            sku: 'SKU-1',
            sale_price: 100,
            created_at: new Date().toISOString(),
            stock_quantity: 100,
            min_quantity: 10
          },
          {
            id: 'var-2',
            name: 'This is a very long product name that should definitely wrap to multiple lines and potentially push the layout down if not handled correctly by min-height constraints',
            sku: 'SKU-2',
            sale_price: 200,
            created_at: new Date().toISOString(),
            stock_quantity: 100,
            min_quantity: 10
          },
          {
            id: 'var-3',
            name: 'Consultation Price Item',
            sku: 'SKU-3',
            sale_price: null,
            created_at: new Date().toISOString(),
            stock_quantity: 100,
            min_quantity: 10
          }
        ];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ records: mockProducts })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/novidades');
    const cards = page.locator('div[role="listitem"]');
    await expect(cards).toHaveCount(3);

    await expect(page.locator('div[role="list"]')).toHaveScreenshot('novelty-card-variations.png');
  });
});

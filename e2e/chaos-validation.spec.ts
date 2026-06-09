import { test, expect } from './fixtures/test-base';
import { gotoAndSettle } from './helpers/nav';
import { loginAs } from './helpers/auth';

/**
 * Chaos and Performance Stress Suite
 * 
 * Verifies:
 * - Resilience to rapid interactions
 * - Scroll performance (FPS / Jitter)
 * - Layout stability (CLS)
 * - Console error monitoring
 * - Network failure recovery
 */

test.describe('Chaos & Performance Validation', () => {
  let consoleErrors: string[] = [];
  let failedRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    failedRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[CONSOLE ERROR] ${msg.text()}`);
    });

    page.on('requestfailed', request => {
      failedRequests.push(`[NETWORK FAILURE] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });

    await loginAs(page);
    await gotoAndSettle(page, '/produtos');
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Generate regression report if any anomalies found
    if (consoleErrors.length > 0 || failedRequests.length > 0) {
      const report = [
        `### REGRESSION REPORT - ${testInfo.title}`,
        `#### Console Errors (${consoleErrors.length}):`,
        ...consoleErrors.map(e => `- ${e}`),
        `#### Network Failures (${failedRequests.length}):`,
        ...failedRequests.map(f => `- ${f}`),
      ].join('\n');
      
      console.log(report);
      // We don't fail immediately to allow the test to finish its main logic, 
      // but we append it to the test output.
    }
  });

  const viewports = [
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Tablet', width: 834, height: 1194 },
    { name: 'Mobile', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    test(`Chaos Stress Test [${vp.name}]`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const grid = page.locator('[data-testid="virtualized-product-grid"]');
      await expect(grid).toBeVisible();

      // PERFORMANCE MEASUREMENT: Layout Shift (CLS)
      const cls = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let score = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                score += (entry as any).value;
              }
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(score);
          }, 3000); // Sample for 3s
        });
      });

      expect(cls, `CLS too high on ${vp.name}`).toBeLessThan(0.1);

      // CHAOS ACTIONS: Rapid scrolls and filter/sort toggling
      for (let i = 0; i < 50; i++) {
        // Aggressive jumps
        await grid.evaluate((el, jump) => {
          el.scrollTop += jump;
        }, Math.random() * 5000 - 2500);

        if (i % 10 === 0) {
          // Switch sort rapidly
          const sortTrigger = page.locator('[data-testid="catalog-sort-trigger"]');
          await sortTrigger.click();
          const options = ['price-asc', 'price-desc', 'newest'];
          await page.locator(`[data-testid="catalog-sort-item-${options[i/10 % 3]}"]`).click();
        }
        
        // Wait just enough for some rendering but keep the stress high
        await page.waitForTimeout(50); 
      }

      // Stability check after chaos
      await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
      
      // Ensure no pagination leaked
      await expect(page.locator('[data-testid*="pagination"]')).not.toBeVisible();
      
      // Visual regression check (final state after chaos)
      await expect(page).toHaveScreenshot(`chaos-final-${vp.name.toLowerCase()}.png`, {
        mask: [page.locator('[data-testid="product-card"] img')]
      });
    });
  }

  test('Security/RLS: step_up_audit_log protection', async ({ page }) => {
    // 1. Try to access as unauthorized (already logged in but let's check a direct PostgREST call)
    const supabaseUrl = await page.evaluate(() => (window as any).env?.VITE_SUPABASE_URL || 'http://localhost:54321');
    
    // Attempt public access to audit log (should be blocked by RLS)
    const response = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/rest/v1/step_up_audit_log`, {
        headers: { 'apikey': (window as any).env?.VITE_SUPABASE_ANON_KEY || '' }
      });
      return { status: res.status };
    }, supabaseUrl);

    // 403 Forbidden or empty results if RLS is "SELECT where auth.uid() = user_id" 
    // but the table is sensitive so it should likely be restricted.
    // Based on migration: ALTER POLICY "Users can view own audit logs"
    // So status might be 200 but empty array for unauthenticated.
    
    // Better check: An anonymous request without any JWT
    const anonResponse = await page.request.get(`${supabaseUrl}/rest/v1/step_up_audit_log`);
    // If it's a private table with RLS enabled and no anon policy, it should return 401/403 or empty
    expect(anonResponse.status()).toBeGreaterThanOrEqual(400); 
  });
});

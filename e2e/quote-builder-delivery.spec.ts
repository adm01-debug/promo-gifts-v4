import { test, expect } from './fixtures/test-base';
import { loginAs } from './helpers/auth';

test.describe('QuoteBuilderPage - Delivery Field E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the new quote page
    await loginAs(page);
    await page.goto('/quotes/new');
    
    // Wait for the page to load
    await page.waitForSelector('[data-testid="delivery-label"]', { timeout: 15000 });
  });

  test('should show and hide delivery tooltip on hover', async ({ page }) => {
    const trigger = page.getByTestId('delivery-info-tooltip-trigger');
    const tooltipContent = page.getByTestId('delivery-info-tooltip-content');

    // Initially tooltip should not be visible
    await expect(tooltipContent).not.toBeVisible();

    // Hover over the info icon
    await trigger.hover();
    
    // Tooltip should be visible and contain expected text
    await expect(tooltipContent).toBeVisible();
    await expect(tooltipContent).toContainText('Antes de assumir o compromisso com seu Cliente');

    // Move mouse away
    await page.mouse.move(0, 0);
    
    // Tooltip should disappear
    await expect(tooltipContent).not.toBeVisible();
  });

  test('should hide tooltip on Escape key', async ({ page }) => {
    const trigger = page.getByTestId('delivery-info-tooltip-trigger');
    const tooltipContent = page.getByTestId('delivery-info-tooltip-content');

    await trigger.hover();
    await expect(tooltipContent).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(tooltipContent).not.toBeVisible();
  });

  test('should verify visual alignment across viewports', async ({ page }) => {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 800 }
    ];

    const container = page.getByTestId('delivery-label-container');

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      // Small wait for layout stability
      await page.waitForTimeout(300);
      
      await expect(container).toBeVisible();
      await expect(container).toHaveScreenshot(`delivery-label-alignment-${vp.name}.png`);
    }
  });

  test('should verify warning banner presence above delivery options', async ({ page }) => {
    const banner = page.locator('div:has-text("Valide a viabilidade do prazo com Fornecedores")').first();
    await expect(banner).toBeVisible();
    await expect(banner).toHaveClass(/bg-warning/);
    
    // Snapshot of the entire delivery section
    const deliverySection = page.locator('.space-y-1:has([data-testid="delivery-label-container"])');
    await expect(deliverySection).toHaveScreenshot('delivery-section-layout.png');
  });
});

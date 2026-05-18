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

  test('should verify visual alignment of delivery label and info icon', async ({ page }) => {
    const container = page.getByTestId('delivery-label-container');
    const label = page.getByTestId('delivery-label');
    const trigger = page.getByTestId('delivery-info-tooltip-trigger');

    // Check CSS properties for alignment
    await expect(container).toHaveCSS('display', 'flex');
    await expect(container).toHaveCSS('align-items', 'center');
    await expect(container).toHaveCSS('gap', '6px'); // gap-1.5 = 0.375rem = 6px

    // Visual regression snapshot of the label area
    await expect(container).toHaveScreenshot('delivery-label-alignment.png');
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

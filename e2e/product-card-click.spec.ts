import { test, expect } from '@playwright/test';

test.describe('ProductCard Pressed State', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that contains ProductCards, e.g., home or catalog
    await page.goto('/');
    // Wait for the grid to load
    await page.waitForSelector('[data-testid="product-card"]');
  });

  test('should not change scale or opacity when clicked (pressed state) - Light Theme', async ({ page }) => {
    const card = page.locator('[data-testid="product-card"]').first();
    
    // Get initial state
    const initialBox = await card.boundingBox();
    const initialOpacity = await card.evaluate((el) => window.getComputedStyle(el).opacity);
    
    // Move mouse to card to trigger hover (which might change scale/opacity intentionally)
    await card.hover();
    const hoverOpacity = await card.evaluate((el) => window.getComputedStyle(el).opacity);
    
    // Click and hold (if possible with playwright, otherwise just click and check state during/after)
    await page.mouse.move(initialBox!.x + initialBox!.width / 2, initialBox!.y + initialBox!.height / 2);
    await page.mouse.down();
    
    // Check state while pressed
    const pressedBox = await card.boundingBox();
    const pressedOpacity = await card.evaluate((el) => window.getComputedStyle(el).opacity);
    const pressedTransform = await card.evaluate((el) => window.getComputedStyle(el).transform);
    
    await page.mouse.up();

    // In many modern CSS setups, scale is part of transform. 
    // We expect transform not to have a scale smaller than 1 (or smaller than the hover scale)
    // And opacity should remain high (not dimming)
    
    expect(parseFloat(pressedOpacity)).toBeGreaterThanOrEqual(0.9); // Should not dim significantly
    expect(pressedTransform).not.toContain('matrix(0.9'); // Should not scale down to 0.98 or similar
    
    // Compare with hover state if hover changes things
    // We want to ensure it doesn't RECEDE (get smaller) from hover state when clicked
    // Note: transforms are complex to compare directly as strings, but matrix(1, 0, 0, 1, 0, 0) is no transform.
  });

  test('should not change scale or opacity when clicked - Dark Theme', async ({ page }) => {
    // Switch to dark theme
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    
    const card = page.locator('[data-testid="product-card"]').first();
    const initialBox = await card.boundingBox();
    
    await page.mouse.move(initialBox!.x + initialBox!.width / 2, initialBox!.y + initialBox!.height / 2);
    await page.mouse.down();
    
    const pressedOpacity = await card.evaluate((el) => window.getComputedStyle(el).opacity);
    const pressedTransform = await card.evaluate((el) => window.getComputedStyle(el).transform);
    
    await page.mouse.up();

    expect(parseFloat(pressedOpacity)).toBeGreaterThanOrEqual(0.9);
    expect(pressedTransform).not.toContain('matrix(0.9');
  });

  test('mobile: should not show pressed feedback', async ({ page }) => {
    // Emulate mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    const card = page.locator('[data-testid="product-card"]').first();
    const initialBox = await card.boundingBox();
    
    // Tap and hold
    await page.mouse.move(initialBox!.x + initialBox!.width / 2, initialBox!.y + initialBox!.height / 2);
    await page.mouse.down();
    
    const pressedOpacity = await card.evaluate((el) => window.getComputedStyle(el).opacity);
    const pressedTransform = await card.evaluate((el) => window.getComputedStyle(el).transform);
    
    await page.mouse.up();

    expect(parseFloat(pressedOpacity)).toBeGreaterThanOrEqual(0.9);
    expect(pressedTransform).not.toContain('matrix(0.9');
  });
});

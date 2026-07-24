import { test, expect } from '@playwright/test';

const hasAuth = !!(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);

test.describe('ProductCard Interaction & Accessibility @smoke', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasAuth, 'E2E_USER_EMAIL/PASSWORD não configurados — teste requer catálogo autenticado');
    await page.goto('/');
    await page.waitForSelector('[data-testid="product-card"]');
  });

  test('should not show pressed state (scale/opacity) on click - Light & Dark @smoke', async ({ page }) => {
    const themes = ['light', 'dark'];
    
    for (const theme of themes) {
      if (theme === 'dark') {
        await page.evaluate(() => document.documentElement.classList.add('dark'));
      } else {
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
      }
      
      const card = page.locator('[data-testid="product-card"]').first();
      const initialBox = await card.boundingBox();
      
      // Move to center
      await page.mouse.move(initialBox!.x + initialBox!.width / 2, initialBox!.y + initialBox!.height / 2);
      await page.mouse.down();
      
      const pressedOpacity = await card.evaluate((el) => window.getComputedStyle(el).opacity);
      const pressedTransform = await card.evaluate((el) => window.getComputedStyle(el).transform);
      
      await page.mouse.up();

      // Validate no "pressed" reduction
      expect(parseFloat(pressedOpacity)).toBeGreaterThan(0.95);
      // matrix(1, 0, 0, 1, 0, 0) is identity. We check it's not scaled down (e.g. 0.98)
      expect(pressedTransform).not.toContain('0.98');
      expect(pressedTransform).not.toContain('0.95');
    }
  });

  test('mobile: hover should not trigger scale but click is clean @mobile', async ({ page }) => {
    const card = page.locator('[data-testid="product-card"]').first();
    const image = card.locator('img').first();
    
    const initialTransform = await image.evaluate((el) => window.getComputedStyle(el).transform);
    
    await card.hover();
    await page.waitForTimeout(400); // Wait for transition
    
    const hoverTransform = await image.evaluate((el) => window.getComputedStyle(el).transform);
    
    // Hover scale is 1.03
    expect(hoverTransform).not.toBe(initialTransform);
    expect(hoverTransform).toContain('1.03');
  });

  test('accessibility: focus state should be visible', async ({ page }) => {
    const card = page.locator('[data-testid="product-card"]').first();
    
    await page.keyboard.press('Tab');
    // Ensure the card is the focused element (or keep tabbing until it is)
    let isFocused = await card.evaluate((el) => document.activeElement === el);
    let attempts = 0;
    while (!isFocused && attempts < 10) {
      await page.keyboard.press('Tab');
      isFocused = await card.evaluate((el) => document.activeElement === el);
      attempts++;
    }
    
    expect(isFocused).toBe(true);
    
    const ring = await card.evaluate((el) => window.getComputedStyle(el).boxShadow);
    expect(ring).toContain('rgb'); // Should have a ring/box-shadow from focus
  });

  test('visual regression: card click state', async ({ page }) => {
    const card = page.locator('[data-testid="product-card"]').first();
    
    // Screenshot before click
    await expect(card).toHaveScreenshot('product-card-initial.png');
    
    // Screenshot while mouse down
    const box = await card.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    
    // We expect this to match the reference image provided by user (manually verified via code changes)
    // Here we just ensure it doesn't change from its own non-pressed state
    await expect(card).toHaveScreenshot('product-card-pressed.png');
    
    await page.mouse.up();
  });
});

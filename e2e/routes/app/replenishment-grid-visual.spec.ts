import { test, expect } from '@playwright/test';

test.describe('Replenishment Grid Visual Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Replenishments page
    await page.goto('/reposicao');
    
    // Wait for the grid to be visible and data to be loaded
    await page.waitForSelector('div[role="list"]');
    // Pequena pausa para garantir que a virtualização e animações estabilizem
    await page.waitForTimeout(1000);
  });

  test('should match baseline screenshot', async ({ page }) => {
    const grid = page.locator('div[role="list"]');
    // Captura screenshot do grid para comparação visual
    await expect(grid).toHaveScreenshot('replenishment-grid.png', {
      maxDiffPixelRatio: 0.05, // Tolera pequenas variações de anti-aliasing
    });
  });

  test('should have consistent vertical and horizontal gaps', async ({ page }) => {


    // Get all card containers
    const cards = await page.locator('div[role="listitem"]').all();
    
    if (cards.length < 2) {
      console.warn('Not enough products to validate grid gaps');
      return;
    }

    // Check first two cards to validate horizontal gap
    const box1 = await cards[0].boundingBox();
    const box2 = await cards[1].boundingBox();

    if (box1 && box2 && box1.y === box2.y) {
      // They are in the same row
      const horizontalGap = box2.x - (box1.x + box1.width);
      // Expected gap is usually 32px (gap-x-8) or 24px (gap-x-6)
      expect(horizontalGap).toBeGreaterThanOrEqual(16); 
    }

    // Check vertical gap if there are enough cards for 2 rows
    // Since it's virtualized, we might need to scroll a bit or just check the first few
    // But usually virtualRow 0 and virtualRow 1 are rendered
    const row1 = page.locator('div[data-index="0"]');
    const row2 = page.locator('div[data-index="1"]');

    if (await row1.isVisible() && await row2.isVisible()) {
      const r1Box = await row1.boundingBox();
      const r2Box = await row2.boundingBox();
      
      if (r1Box && r2Box) {
        const verticalGap = r2Box.y - (r1Box.y + r1Box.height);
        // We added pb-8 to the row, so the measured height should include it, 
        // OR the gap should be exactly 0 if pb-8 is inside the measured element and 
        // virtualizer positions them back-to-back.
        // Actually, virtualizer positions them using 'virtualRow.start'.
        // If measureElement is working, virtualRow.start of row 1 = row 0.start + row 0.height.
        // So verticalGap between bounding boxes should be close to 0, but the CONTENT 
        // inside has pb-8.
        
        // Let's check the gap between the last card of row 1 and first card of row 2
        const cardInRow1 = row1.locator('div[role="listitem"]').first();
        const cardInRow2 = row2.locator('div[role="listitem"]').first();
        
        const c1Box = await cardInRow1.boundingBox();
        const c2Box = await cardInRow2.boundingBox();
        
        if (c1Box && c2Box) {
          const cardVerticalGap = c2Box.y - (c1Box.y + c1Box.height);
          // Expected gap is 32px (gap-y-8)
          expect(cardVerticalGap).toBeGreaterThanOrEqual(24);
        }
      }
    }
  });

  test('cards should have uniform internal alignment', async ({ page }) => {
    const cards = await page.locator('div[role="listitem"]').all();
    if (cards.length === 0) return;

    for (const card of cards.slice(0, 5)) {
      const h3 = card.locator('h3');
      const h3Box = await h3.boundingBox();
      
      // Ensure h3 has a minimum height
      if (h3Box) {
        expect(h3Box.height).toBeGreaterThanOrEqual(36); // sm:min-h-[2.75rem] is 44px, 2.25rem is 36px
      }
      
      // Check price section height consistency
      const priceSection = card.locator('.flex.items-end.justify-between').first();
      const priceBox = await priceSection.boundingBox();
      if (priceBox) {
        expect(priceBox.height).toBeGreaterThanOrEqual(48); // sm:min-h-[3.5rem] is 56px, 3rem is 48px
      }
    }
  });
});

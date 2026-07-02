/**
 * Regressão visual + E2E do AlertDialog cru (mesmo dimensionamento aplicado
 * no `QuoteItemEditorSheet`: `!max-w-[358px] w-[92vw]`).
 *
 * Valida em 180/320/375/768:
 *   1) baseline PNG por largura
 *   2) bounding box = min(358px, viewport*0.92) ± 4px
 *   3) sem overflow horizontal (x, x+width dentro do viewport)
 *   4) sem overflow vertical (y, y+height dentro do viewport)
 *   5) botões do footer também totalmente visíveis (H + V)
 */
import { test, expect } from '@playwright/test';

const WIDTHS = [180, 320, 375, 768] as const;
const MAX_SINGLE_LINE_HEIGHT_PX = 48;
const MIN_BUTTON_HEIGHT_PX = 20;

for (const width of WIDTHS) {
  test.describe(`AlertDialog visual — ${width}px`, () => {
    test.use({ viewport: { width, height: 720 } });

    test(`baseline + no-clip H/V (${width}px)`, async ({ page }) => {
      await page.goto(`/__test/alert-dialog?width=${width}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('[data-testid="harness-ready"]');
      await page.addStyleTag({
        content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`,
      });

      const dialog = page.getByTestId('alert-dialog-content');
      await expect(dialog).toBeVisible();

      // 1) baseline visual
      await expect(dialog).toHaveScreenshot(`alert-dialog-${width}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });

      // 2) bounding box ~358px
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      const vpSize = page.viewportSize()!;
      const expectedWidth = Math.min(358, vpSize.width * 0.92);
      expect(Math.abs(box!.width - expectedWidth)).toBeLessThanOrEqual(4);

      // 3) sem overflow horizontal
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vpSize.width + 1);

      // 4) sem overflow vertical
      expect(box!.y).toBeGreaterThanOrEqual(-1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(vpSize.height + 1);

      // 5) botões do footer visíveis e dentro do viewport (H + V)
      for (const testId of ['alert-dialog-cancel', 'alert-dialog-confirm']) {
        const btn = page.getByTestId(testId);
        await expect(btn).toBeVisible();
        const btnBox = await btn.boundingBox();
        expect(btnBox).not.toBeNull();
        expect(btnBox!.x).toBeGreaterThanOrEqual(-1);
        expect(btnBox!.x + btnBox!.width).toBeLessThanOrEqual(vpSize.width + 1);
        expect(btnBox!.y).toBeGreaterThanOrEqual(-1);
        expect(btnBox!.y + btnBox!.height).toBeLessThanOrEqual(vpSize.height + 1);
        expect(btnBox!.height).toBeGreaterThan(MIN_BUTTON_HEIGHT_PX);
        expect(btnBox!.height).toBeLessThanOrEqual(MAX_SINGLE_LINE_HEIGHT_PX);
      }
    });
  });
}

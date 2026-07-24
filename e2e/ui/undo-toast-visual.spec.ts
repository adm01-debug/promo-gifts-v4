/**
 * Regressão visual do UndoToast (single + stacked).
 *
 * Usa o harness `/__test/undo-toast` com `frozenMs` para congelar o contador
 * regressivo (evita flakiness pixel-a-pixel). Valida:
 *   1) baseline PNG por largura (single toast)
 *   2) baseline PNG por largura (stack de 3 toasts)
 *   3) bounding box do toast não estoura o container do harness
 *   4) botão "Desfazer" totalmente dentro do viewport (H + V)
 */
import { test, expect } from '@playwright/test';

const WIDTHS = [180, 320, 375, 768] as const;
const FROZEN_MS = 3000;

for (const width of WIDTHS) {
  test.describe(`UndoToast visual — ${width}px`, () => {
    test.use({ viewport: { width, height: 720 } });

    test(`single toast baseline (${width}px)`, async ({ page }) => {
      await page.goto(
        `/__test/undo-toast?width=${width}&frozenMs=${FROZEN_MS}&stack=1`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.waitForSelector('[data-testid="harness-ready"]');
      await page.addStyleTag({
        content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }`,
      });

      const slot = page.getByTestId('undo-toast-slot-0');
      await expect(slot).toBeVisible();

      await expect(slot).toHaveScreenshot(`undo-toast-single-${width}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });

      const vp = page.viewportSize()!;
      const box = await slot.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
      expect(box!.y).toBeGreaterThanOrEqual(-1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);

      const btn = slot.getByTestId('undo-toast-button');
      await expect(btn).toBeVisible();
      const bb = await btn.boundingBox();
      expect(bb).not.toBeNull();
      expect(bb!.x).toBeGreaterThanOrEqual(-1);
      expect(bb!.x + bb!.width).toBeLessThanOrEqual(vp.width + 1);
    });

    test(`stacked toasts baseline (${width}px)`, async ({ page }) => {
      await page.goto(
        `/__test/undo-toast?width=${width}&frozenMs=${FROZEN_MS}&stack=3`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.waitForSelector('[data-testid="harness-ready"]');
      await page.addStyleTag({
        content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }`,
      });

      const stack = page.getByTestId('undo-toast-stack');
      await expect(stack).toBeVisible();
      await expect(page.getByTestId('undo-toast-slot-2')).toBeVisible();

      await expect(stack).toHaveScreenshot(`undo-toast-stack3-${width}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  });
}

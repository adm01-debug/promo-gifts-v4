/**
 * E2E — trio do NegotiationMarkupCard (Margem + REAL + CLIENTE VÊ).
 *
 * Valida em sm/md/lg:
 *  - Presença dos 3 alvos via data-testid
 *  - Ordem no DOM: REAL antes de CLIENTE VÊ
 *  - Layout horizontal: REAL à esquerda, CLIENTE VÊ à direita (mesma linha,
 *    tops alinhados dentro de tolerância de 2px)
 *  - Snapshot visual do card por viewport
 *
 * Harness DEV-only em `/__visual/negotiation-markup-card` (sem auth).
 */
import { test, expect } from '@playwright/test';

const ROUTE = '/__visual/negotiation-markup-card';

const VIEWPORTS = [
  { name: 'sm', width: 640, height: 900 },
  { name: 'md', width: 768, height: 900 },
  { name: 'lg', width: 1024, height: 900 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`NegotiationMarkupCard @ ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('trio presente, ordem correta e alinhamento horizontal', async ({ page }) => {
      await page.goto(ROUTE);
      const card = page.getByTestId('negotiation-markup-card');
      const grid = page.getByTestId('negotiation-price-grid');
      const real = page.getByTestId('price-card-real');
      const cliente = page.getByTestId('price-card-client');

      await expect(card).toBeVisible();
      await expect(grid).toBeVisible();
      await expect(real).toBeVisible();
      await expect(cliente).toBeVisible();

      // Ordem no DOM (REAL antes de CLIENTE VÊ)
      const domOrder = await grid.evaluate((g) =>
        Array.from(g.children).map((c) => (c as HTMLElement).dataset.testid),
      );
      expect(domOrder).toEqual(['price-card-real', 'price-card-client']);

      // Layout horizontal: tops praticamente alinhados; cliente à direita do real
      const [realBox, clienteBox] = await Promise.all([
        real.boundingBox(),
        cliente.boundingBox(),
      ]);
      expect(realBox && clienteBox).toBeTruthy();
      expect(Math.abs((realBox!.y) - (clienteBox!.y))).toBeLessThanOrEqual(2);
      expect(clienteBox!.x).toBeGreaterThan(realBox!.x + realBox!.width - 4);
    });

    test('snapshot visual do card', async ({ page }) => {
      await page.goto(ROUTE);
      const card = page.getByTestId('negotiation-markup-card');
      await expect(card).toBeVisible();
      await expect(card).toHaveScreenshot(`negotiation-markup-card-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  });
}

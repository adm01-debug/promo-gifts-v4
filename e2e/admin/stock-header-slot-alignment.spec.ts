/**
 * E2E — Slot do header de Estoque
 *
 * Verifica que o bloco "Atualizado…" é portalizado ao lado do título "Estoque",
 * fica visível e alinhado verticalmente em desktop e mobile, sem quebra de linha.
 */
import { test, expect, type Page } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'desktop', width: 1536, height: 864 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function setup(page: Page) {
  await loginAs(page);
  await gotoAndSettle(page, '/estoque');
}

test.describe('Estoque — slot do header (alinhamento e visibilidade)', () => {
  for (const vp of VIEWPORTS) {
    test(`"Atualizado…" alinhado ao título em ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setup(page);

      const title = page.getByTestId('page-title-estoque');
      const slot = page.getByTestId('stock-header-slot');
      const refresh = page.getByTestId('stock-last-refresh');

      await expect(title).toBeVisible();
      await expect(slot).toBeVisible();
      await expect(refresh).toBeVisible();

      // Texto presente sem truncar a palavra-chave
      await expect(refresh).toContainText(/Atualizado/i);

      const [titleBox, slotBox, refreshBox] = await Promise.all([
        title.boundingBox(),
        slot.boundingBox(),
        refresh.boundingBox(),
      ]);

      expect(titleBox, 'title bounding box').not.toBeNull();
      expect(slotBox, 'slot bounding box').not.toBeNull();
      expect(refreshBox, 'refresh bounding box').not.toBeNull();
      if (!titleBox || !slotBox || !refreshBox) return;

      // Refresh deve estar à direita do título
      expect(refreshBox.x).toBeGreaterThan(titleBox.x);

      // Alinhamento vertical: baselines (parte de baixo) próximas do título — items-end no flex
      const titleBottom = titleBox.y + titleBox.height;
      const refreshBottom = refreshBox.y + refreshBox.height;
      expect(Math.abs(titleBottom - refreshBottom)).toBeLessThanOrEqual(8);

      // Não quebra em mais de uma linha — altura limitada (~ font-size do xs/sm)
      expect(refreshBox.height).toBeLessThanOrEqual(28);

      // Não deve transbordar o viewport horizontalmente
      expect(refreshBox.x + refreshBox.width).toBeLessThanOrEqual(vp.width);
    });
  }
});

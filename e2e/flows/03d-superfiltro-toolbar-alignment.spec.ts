/**
 * E2E — Super Filtro: alinhamento à direita dos botões "Selecionar" e "Layout"
 *
 * Garante que ambos os botões permaneçam pinned na borda direita da página
 * (padrão idêntico ao CatalogToolbar) em desktop, tablet e mobile — sem quebrar
 * para o centro nem desalinhar quando a área de filtros encolhe.
 */
import { test, expect, type Page } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'desktop', width: 1536, height: 864 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function setup(page: Page) {
  await loginAs(page);
  await gotoAndSettle(page, '/produtos');
  await expect(page.getByTestId('page-title-produtos')).toBeVisible();
}

test.describe('Super Filtro — alinhamento Selecionar/Layout à direita', () => {
  for (const vp of VIEWPORTS) {
    test(`Selecionar e Layout pinned à direita em ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setup(page);

      const selectBtn = page.getByRole('button', { name: /Ativar modo de seleção|Cancelar seleção/i }).first();
      const layoutBtn = page.getByTestId('layout-popover-trigger');

      await expect(selectBtn).toBeVisible();
      await expect(layoutBtn).toBeVisible();

      const [selBox, layBox] = await Promise.all([
        selectBtn.boundingBox(),
        layoutBtn.boundingBox(),
      ]);
      expect(selBox, 'select bounding box').not.toBeNull();
      expect(layBox, 'layout bounding box').not.toBeNull();
      if (!selBox || !layBox) return;

      // Layout fica à direita do Selecionar (ordem horizontal preservada)
      expect(layBox.x).toBeGreaterThan(selBox.x);

      // Ambos alinhados verticalmente (mesma row do flex)
      expect(Math.abs(selBox.y - layBox.y)).toBeLessThanOrEqual(4);

      // Borda direita do Layout próxima da borda direita do viewport
      // (tolerância generosa por causa de padding global do container).
      const layoutRight = layBox.x + layBox.width;
      const distanceToEdge = vp.width - layoutRight;
      expect(distanceToEdge).toBeGreaterThanOrEqual(0);
      expect(distanceToEdge).toBeLessThanOrEqual(80);

      // Não pode estar centralizado: centro do grupo deve estar na metade DIREITA do viewport
      const groupCenter = (selBox.x + layoutRight) / 2;
      expect(groupCenter).toBeGreaterThan(vp.width / 2);
    });
  }
});

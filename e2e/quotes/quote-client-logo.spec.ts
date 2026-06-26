/**
 * E2E — Logomarca do cliente na lista de Orçamentos.
 *
 * Cobre:
 *  - Renderização do avatar (logo ou fallback de iniciais) ao lado do nome.
 *  - Alinhamento horizontal de logo + nome em viewport mobile (375px).
 *
 * Snapshots visuais da lista não existem como baseline — não há `--update-snapshots`
 * para regenerar aqui. A verificação é estrutural (bounding boxes).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Orçamentos — logo do cliente', () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth();
    await gotoAndSettle(page, '/orcamentos');
  });

  test('avatar e nome do cliente alinhados horizontalmente em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const cell = page.locator('[data-testid="quote-client-cell"]').first();
    await expect(cell).toBeVisible({ timeout: 10_000 });

    const avatar = cell.locator('img, [data-testid="avatar-logo-skeleton"], div').first();
    const name = cell.locator('span').first();

    const aBox = await avatar.boundingBox();
    const nBox = await name.boundingBox();
    expect(aBox).not.toBeNull();
    expect(nBox).not.toBeNull();
    if (!aBox || !nBox) return;

    // Centros verticais devem coincidir (~tolerância 8px) — mesma linha
    const aMid = aBox.y + aBox.height / 2;
    const nMid = nBox.y + nBox.height / 2;
    expect(Math.abs(aMid - nMid)).toBeLessThanOrEqual(8);

    // Avatar à esquerda do nome
    expect(aBox.x + aBox.width).toBeLessThanOrEqual(nBox.x + 4);
  });
});

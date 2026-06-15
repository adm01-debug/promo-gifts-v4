/**
 * E2E — Toggle de badges × badge "Estoque baixo".
 *
 * Cenário: o item "Badges: Ocultar/Exibir" no menu do usuário (Header)
 * controla TODAS as badges de status, incluindo a urgência "Estoque baixo"
 * (`urgencyType="limited-stock"`). Antes do fix, essa urgência específica
 * permanecia visível mesmo com badges desligadas.
 *
 * Passos:
 *  1. Vai para /produtos e procura um card com a badge "Estoque baixo".
 *  2. Abre o menu do usuário e clica em "Badges: Ocultar".
 *  3. Verifica que a badge desapareceu.
 *  4. Clica novamente em "Badges: Exibir".
 *  5. Verifica que a badge voltou.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Header — toggle de badges controla "Estoque baixo"', () => {
  test.beforeEach(() => requireAuth());

  test('alternar badges oculta e reexibe a badge "Estoque baixo"', async ({ page }) => {
    await gotoAndSettle(page, '/produtos');

    const lowStockBadge = page.locator('text=/^Estoque baixo$/i').first();
    const hasLowStock = await lowStockBadge.count();
    if (!hasLowStock) {
      test.skip(true, 'Nenhum produto com badge "Estoque baixo" no dataset atual.');
      return;
    }
    await expect(lowStockBadge).toBeVisible();

    // Helper: abre o menu de preferências e clica no toggle de badges
    const toggle = async () => {
      await page.locator('[data-testid="user-menu-trigger"]').first().click();
      const item = page.locator('[data-testid="header-toggle-badges"]');
      await expect(item).toBeVisible();
      await item.click();
      // fecha o menu caso permaneça aberto
      await page.keyboard.press('Escape').catch(() => {});
    };

    // 1) desligar
    await toggle();
    await expect(lowStockBadge).toBeHidden({ timeout: 5000 });

    // 2) religar
    await toggle();
    await expect(lowStockBadge).toBeVisible({ timeout: 5000 });
  });
});

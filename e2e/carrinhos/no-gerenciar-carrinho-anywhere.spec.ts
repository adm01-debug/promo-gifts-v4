/**
 * E2E de regressão global: o rótulo "Gerenciar Carrinho" foi removido em
 * definitivo e não pode reaparecer em NENHUMA página relacionada a
 * carrinhos/orçamentos — nem em breadcrumbs, labels visíveis, botões,
 * títulos (`title`) ou tooltips (`aria-label`).
 *
 * Cobre viewports desktop e mobile e as rotas críticas do fluxo:
 *   - /carrinhos            (lista de carrinhos)
 *   - /carrinhos/:id        (detalhe do carrinho ativo)
 *   - /orcamentos           (lista de orçamentos)
 *
 * Se este teste falhar, alguém reintroduziu o rótulo em algum ponto da UI.
 */
import { test, expect, type Page } from '@playwright/test';
import { setupAuthedWithCarts } from '../helpers/cart-setup';
import { gotoAndSettle } from '../helpers/nav';

const FORBIDDEN = /Gerenciar Carrinho/i;

async function assertNoGerenciarCarrinho(page: Page) {
  // Texto visível
  await expect(page.getByText(FORBIDDEN)).toHaveCount(0);
  // Botão acessível
  await expect(page.getByRole('button', { name: FORBIDDEN })).toHaveCount(0);
  // Link acessível (breadcrumb / nav)
  await expect(page.getByRole('link', { name: FORBIDDEN })).toHaveCount(0);
  // Atributos que alimentam tooltip nativo / SR
  await expect(page.locator('[title*="Gerenciar Carrinho" i]')).toHaveCount(0);
  await expect(page.locator('[aria-label*="Gerenciar Carrinho" i]')).toHaveCount(0);
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Regressão · "Gerenciar Carrinho" ausente (${vp.name}) @carrinhos`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test('lista de carrinhos, detalhe do carrinho e /orcamentos não expõem o rótulo', async ({
      page,
    }) => {
      const { carts } = await setupAuthedWithCarts(page, {
        role: 'user',
        count: 1,
        itemsPerCart: 2,
        gotoUrl: '/carrinhos',
      });
      await assertNoGerenciarCarrinho(page);

      await gotoAndSettle(page, `/carrinhos/${carts[0].id}`);
      await assertNoGerenciarCarrinho(page);

      await gotoAndSettle(page, '/orcamentos');
      await assertNoGerenciarCarrinho(page);
    });
  });
}

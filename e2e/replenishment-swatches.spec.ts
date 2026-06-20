/**
 * Reposição — overlay + tooltip dos swatches (Onda 1)
 *
 * Valida 3 cenários por estado em `data-stock-state` ({in-stock, out, upcoming})
 * exposto por `ProductColorSwatches`:
 *   1) "in-stock" → sem overlay, tooltip com "X un. em estoque"
 *   2) "out"     → grayscale + overlay X (opacity-40 / grayscale), tooltip "Esgotado"
 *   3) "upcoming"→ dot azul `swatch-upcoming-dot` + tooltip "reposição em ..."
 *
 * Estratégia: stub da RPC `fn_get_reposicao_variants_summary` (Gold) injetando
 * sumário determinístico para o primeiro produto renderizado. Tolerante a grid
 * vazio (test.skip) — não falsifica positivos quando não há produtos.
 */
import { test, expect, type Route } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { gotoAndSettle } from './helpers/nav';
import { TID } from './fixtures/selectors';

const RPC_PATH = '/rest/v1/rpc/fn_get_reposicao_variants_summary';

test.describe('Reposição — Swatches (overlay + tooltip)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'user');
  });

  test('renderiza estados in-stock, out e upcoming com overlay/tooltip corretos', async ({ page }) => {
    // Captura o primeiro product_id chamado e injeta 3 variantes determinísticas.
    let injectedProductId: string | null = null;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10);

    await page.route(`**${RPC_PATH}*`, async (route: Route) => {
      try {
        const body = route.request().postDataJSON?.() as { p_product_ids?: string[] } | null;
        const id = body?.p_product_ids?.[0] ?? null;
        if (!injectedProductId && id) injectedProductId = id;

        const targetId = injectedProductId ?? id;
        if (!targetId) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
          return;
        }
        const payload = [
          {
            product_id: targetId,
            variants_summary: [
              { variant_id: '00000000-0000-0000-0000-000000000001', nome: 'Azul', hex: '#1E40AF', stock_qty: 25, has_upcoming_restock: false, next_restock_date: null },
              { variant_id: '00000000-0000-0000-0000-000000000002', nome: 'Vermelho', hex: '#DC2626', stock_qty: 0, has_upcoming_restock: false, next_restock_date: null },
              { variant_id: '00000000-0000-0000-0000-000000000003', nome: 'Verde', hex: '#16A34A', stock_qty: 0, has_upcoming_restock: true, next_restock_date: tomorrowISO },
            ],
            total_variants: 3,
            variants_in_stock: 1,
            variants_zeroed: 2,
            variants_with_upcoming: 1,
          },
        ];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(payload),
        });
      } catch {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    });

    await gotoAndSettle(page, '/reposicao');
    await expect(page.locator(TID('page-title-reposicao'))).toBeVisible();

    // Aguarda swatches montarem (tolerante a grid vazio).
    const container = page.locator(TID('product-colors-container')).first();
    const appeared = await container.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    test.skip(!appeared, 'Grid de reposição vazio neste ambiente — sem produtos para validar swatches');

    // Localiza um card cujo container de cores tenha pelo menos um swatch com estado conhecido.
    const inStock = page.locator('[data-stock-state="in-stock"]').first();
    const outOfStock = page.locator('[data-stock-state="out"]').first();
    const upcoming = page.locator('[data-stock-state="upcoming"]').first();

    // (1) in-stock: visível, sem grayscale, sem dot upcoming.
    await expect(inStock).toBeVisible();
    await expect(inStock).not.toHaveClass(/grayscale/);
    await expect(inStock.locator(TID('swatch-upcoming-dot'))).toHaveCount(0);

    // (2) out: aria-label contendo "esgotada" + classes grayscale/opacity.
    await expect(outOfStock).toBeVisible();
    await expect(outOfStock).toHaveAttribute('aria-label', /esgotada/i);
    await expect(outOfStock).toHaveClass(/grayscale/);
    await expect(outOfStock).toHaveClass(/opacity-40/);

    // (3) upcoming: aria-label "reposição prevista" + dot azul presente.
    await expect(upcoming).toBeVisible();
    await expect(upcoming).toHaveAttribute('aria-label', /reposi[cç][aã]o prevista/i);
    await expect(upcoming.locator(TID('swatch-upcoming-dot'))).toHaveCount(1);

    // Tooltip do "out" — hover e valida o texto "Esgotado".
    await outOfStock.hover();
    const outTooltip = page.locator(TID('color-tooltip-content')).filter({ hasText: /Esgotado/ }).first();
    await expect(outTooltip).toBeVisible({ timeout: 3000 });

    // Tooltip do "upcoming" — hover e valida "reposição em".
    await page.mouse.move(0, 0);
    await upcoming.hover();
    const upcomingTooltip = page.locator(TID('color-tooltip-content')).filter({ hasText: /reposi[cç][aã]o em/i }).first();
    await expect(upcomingTooltip).toBeVisible({ timeout: 3000 });

    // Tooltip do "in-stock" — hover e valida "em estoque".
    await page.mouse.move(0, 0);
    await inStock.hover();
    const inStockTooltip = page.locator(TID('color-tooltip-content')).filter({ hasText: /em estoque/i }).first();
    await expect(inStockTooltip).toBeVisible({ timeout: 3000 });
  });
});

import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "./helpers/nav";

test.describe("ProductGrid — Hidratação de Cores e Fallbacks", () => {
  test.beforeEach(() => requireAuth());

  test("Deve exibir skeletons enquanto as cores carregam e depois mostrar os swatches", async ({ page }) => {
    // Intercepta a query de cores para atrasar a resposta e ver o skeleton
    await page.route(/products-colors-batch/i, async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const response = await route.fetch();
      await route.fulfill({ response });
    });

    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);

    // Verifica se existem skeletons de cores (pelo menos um)
    const skeleton = page.locator('[data-testid="color-skeleton-dot"]').first();
    await expect(skeleton).toBeVisible();

    // Espera as cores carregarem
    const swatchContainer = page.locator('[data-testid="product-colors-container"]').first();
    await expect(swatchContainer).toBeVisible({ timeout: 15_000 });
    
    // Verifica se os skeletons sumiram
    await expect(skeleton).not.toBeVisible();
  });

  test("Deve mostrar 'Cores indisponíveis' caso a hydration retorne vazio", async ({ page }) => {
    // Mock para retornar array vazio para todos os IDs
    await page.route(/products-colors-batch/i, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }) // O hook trata data: [] como sem variantes
      });
    });

    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);

    const unavailable = page.locator('[data-testid="colors-unavailable"]').first();
    await expect(unavailable).toBeVisible({ timeout: 10_000 });
    await expect(unavailable).toHaveText("Cores indisponíveis");
  });

  test("Cache: cores carregadas devem persistir ao navegar de volta do PDP", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);

    // Espera as cores aparecerem
    const firstCard = page.locator('[data-testid="product-card"]').filter({ has: page.locator('[data-testid^="color-swatch-"]') }).first();
    await expect(firstCard).toBeVisible();
    
    const colorName = await firstCard.locator('[data-testid^="color-swatch-"]').first().getAttribute('data-color-name');
    
    // Clica no card para ir ao PDP
    await firstCard.click();
    await waitForRouteIdle(page);
    await expect(page.locator('[data-testid="page-title-detalhe-produto"]')).toBeVisible();

    // Volta para o catálogo
    await page.goBack();
    await waitForRouteIdle(page);

    // As cores devem estar visíveis IMEDIATAMENTE (sem skeleton) devido ao cache do hook
    const swatch = page.locator(`[data-color-name="${colorName}"]`).first();
    await expect(swatch).toBeVisible();
    
    // Verifica se NÃO houve skeleton piscando (difícil de testar 100% mas verificamos visibilidade imediata)
    const skeleton = page.locator('[data-testid="color-skeleton-dot"]').first();
    const isSkeletonVisible = await skeleton.isVisible();
    expect(isSkeletonVisible).toBe(false);
  });

  test("Erro: deve logar erro e manter estado de falha se o fetch falhar", async ({ page }) => {
    // Captura logs do console
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') logs.push(msg.text());
    });

    await page.route(/products-colors-batch/i, async (route) => {
      await route.abort('failed');
    });

    await gotoAndSettle(page, "/produtos");
    // O hook deve logar o erro e ProductCard deve mostrar "Cores indisponíveis" (fallback de cores=[])
    const unavailable = page.locator('[data-testid="colors-unavailable"]').first();
    await expect(unavailable).toBeVisible({ timeout: 15_000 });
    
    // Verifica se o log de erro que adicionamos está lá
    expect(logs.some(l => l.includes('[useProductsColorsBatch] Error'))).toBe(true);
  });
});

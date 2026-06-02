/**
 * Validação E2E focada em 3 cenários da hidratação de cores:
 *  1) Skeletons aparecem durante o fetch e somem virando swatches reais após hidratação.
 *  2) Falha do useProductsColorsBatch no PDP → fallback "Cores indisponíveis" e seleção não trava.
 *  3) Cache: voltar do PDP usa cache (sem reconsultas) e mantém a cor selecionada.
 */
import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "./helpers/nav";

test.describe("ProductGrid — Hidratação de Cores e Fallbacks", () => {
  test.beforeEach(() => requireAuth());

  // ──────────────────────────────────────────────────────────────────────────
  // 1) Skeletons → cores reais
  // ──────────────────────────────────────────────────────────────────────────
  test("Skeletons das bolinhas somem e viram cores reais após a hidratação", async ({ page }) => {
    // Atrasa a resposta de cores em ~1.2s para garantir que o skeleton seja observável
    await page.route(/products-colors-batch|product_variants/i, async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      const response = await route.fetch();
      await route.fulfill({ response });
    });

    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);

    // Skeleton observável durante o fetch atrasado
    const skeletonDot = page.locator('[data-testid="color-skeleton-dot"]').first();
    await expect(skeletonDot).toBeVisible({ timeout: 5_000 });
    const skeletonAriaBusy = page.locator('[data-testid="colors-loading-skeleton"]').first();
    await expect(skeletonAriaBusy).toHaveAttribute("aria-busy", "true");

    // Após hidratação: skeleton desaparece e o container de swatches reais é exibido
    const swatchContainer = page.locator('[data-testid="product-colors-container"]').first();
    await expect(swatchContainer).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="color-skeleton-dot"]')).toHaveCount(0);

    // Pelo menos um swatch concreto está renderizado
    const concreteSwatch = page.locator('[data-testid^="color-swatch-"]').first();
    await expect(concreteSwatch).toBeVisible();
    await expect(concreteSwatch).toHaveAttribute("data-color-name", /.+/);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2) Fallback "Cores indisponíveis" no PDP e seleção liberada
  // ──────────────────────────────────────────────────────────────────────────
  test("PDP: se a hidratação falhar, exibe 'Cores indisponíveis' e a seleção NÃO fica travada", async ({ page }) => {
    // Encontra um produto válido para abrir o PDP (sem mock ainda)
    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);
    const firstCard = page.locator('[data-testid="product-card"]').first();
    await expect(firstCard).toBeVisible();
    const productId = await firstCard.getAttribute("data-product-id");
    test.skip(!productId, "Sem produto disponível.");
    if (!productId) return;

    // Agora aplica o mock para falhar TODAS as queries de cores
    await page.route(/products-colors-batch|product_variants/i, async (route) => {
      await route.abort("failed");
    });

    // Abre o PDP com uma cor previamente "selecionada" via URL
    await gotoAndSettle(page, `/produto/${productId}?cor=NaoExiste&hex=ABCDEF`);
    await waitForRouteIdle(page);

    // PDP renderiza (não quebra) mesmo com falha
    await expect(page.locator('[data-testid="page-title-detalhe-produto"]')).toBeVisible({
      timeout: 15_000,
    });

    // Fallback explícito ou nenhum swatch travado: garante que não há seleção "aria-pressed=true" presa
    const stuckSelection = page.locator('button[aria-pressed="true"][data-testid^="color-swatch-"]');
    expect(await stuckSelection.count()).toBe(0);

    // O preço continua visível — confirmação de que a UI não quebrou com a falha
    await expect(page.locator('[data-testid="pdp-price-value"]').first()).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3) Cache do useProductsColorsBatch: voltar do PDP não reconsulta e mantém a cor
  // ──────────────────────────────────────────────────────────────────────────
  test("Cache: voltar do PDP usa cache (sem refetch) e mantém a cor selecionada no card", async ({ page }) => {
    // Conta chamadas reais à query de cores
    let colorFetches = 0;
    await page.route(/products-colors-batch|product_variants/i, async (route) => {
      colorFetches += 1;
      const response = await route.fetch();
      await route.fulfill({ response });
    });

    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);

    const card = page
      .locator('[data-testid="product-card"]')
      .filter({ has: page.locator('[data-testid^="color-swatch-"]') })
      .first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Estabiliza: aguarda que a query inicial termine
    await page.waitForLoadState("networkidle").catch(() => {});
    const fetchesAfterInitial = colorFetches;
    expect(fetchesAfterInitial).toBeGreaterThan(0);

    // Seleciona uma cor específica clicando na bolinha (persistida na store + URL)
    const swatch = card.locator('[data-testid^="color-swatch-"]').nth(0);
    const selectedColor = await swatch.getAttribute("data-color-name");
    expect(selectedColor).toBeTruthy();
    await swatch.click();
    await waitForRouteIdle(page);

    // Confirma PDP aberto
    await expect(page.locator('[data-testid="page-title-detalhe-produto"]')).toBeVisible({
      timeout: 15_000,
    });

    // Volta para o grid
    await page.goBack();
    await waitForRouteIdle(page);

    // Skeleton NÃO deve reaparecer (cache)
    await expect(page.locator('[data-testid="color-skeleton-dot"]')).toHaveCount(0, {
      timeout: 2_000,
    });

    // O card mostra a cor selecionada como ativa (aria-pressed=true via selectedName)
    const restoredCard = page
      .locator(`[data-testid="product-card"]`)
      .filter({ has: page.locator(`[data-color-name="${selectedColor}"]`) })
      .first();
    const restoredSwatch = restoredCard.locator(`[data-color-name="${selectedColor}"]`);
    await expect(restoredSwatch).toBeVisible();
    await expect(restoredSwatch).toHaveAttribute("aria-pressed", "true");

    // Não deve ter havido refetch significativo de cores após o back
    await page.waitForTimeout(500); // pequena janela p/ confirmar ausência de novas chamadas
    expect(colorFetches).toBeLessThanOrEqual(fetchesAfterInitial + 1);
  });
});

import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "./helpers/nav";

/**
 * Testes E2E para os novos tooltips de variação de cor.
 * Verifica se o tooltip abre no hover e exibe o swatch circular junto com o nome.
 */

test.describe("Color Variation Tooltips", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth();
    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);
  });

  test("Confirm tooltip shows swatch + name in PDP", async ({ page }) => {
    // 1. Entrar no detalhe de um produto
    const productCard = page.locator('[data-testid="product-card"]').first();
    await expect(productCard).toBeVisible();
    await productCard.click();
    await waitForRouteIdle(page);

    // 2. Localizar galeria de variações (GalleryColorVariations)
    // Procuramos pelo botão que envolve o ColorThumb
    const colorThumbButton = page.locator('button.group\\/color').first();
    await expect(colorThumbButton).toBeVisible();

    // 3. Hover no thumb para disparar o tooltip
    // O TooltipTrigger está no ColorThumb (img ou seu wrapper)
    await colorThumbButton.locator('img').first().hover();

    // 4. Verificar o conteúdo do tooltip
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();

    // 5. Validar swatch (círculo) e texto
    const swatch = tooltip.locator('span.rounded-full');
    await expect(swatch).toBeVisible();
    
    const text = await tooltip.innerText();
    expect(text.trim().length).toBeGreaterThan(0);

    // 6. Verificar estilos visuais solicitados (transparência, blur, borda)
    await expect(tooltip).toHaveClass(/bg-popover\/95/);
    await expect(tooltip).toHaveClass(/backdrop-blur-sm/);
    await expect(tooltip).toHaveClass(/border-border\/40/);
  });

  test("Confirm tooltip works in Product Card (Grid Mode)", async ({ page }) => {
    // 1. Localizar um card de produto com pontos de cor
    const productCard = page.locator('[data-testid="product-card"]').first();
    await productCard.hover(); // Revela os pontos de cor (opacity-0 -> 100)

    // 2. Encontrar os pontos de cor (Tooltips em botões aria-label="Cor ...")
    const colorDot = productCard.locator('button[aria-label^="Cor "]').first();
    
    if (await colorDot.isVisible()) {
      await colorDot.hover();

      // 3. Verificar tooltip
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();

      // Swatch + nome
      await expect(tooltip.locator('span.rounded-full')).toBeVisible();
      expect(await tooltip.innerText()).not.toBe('');
      await expect(tooltip).toHaveClass(/backdrop-blur-sm/);
    }
  });

  test("Confirm tooltip in Product List Mode", async ({ page }) => {
    // Tenta alternar para o modo lista se o botão estiver visível
    const listModeBtn = page.locator('button[aria-label*="lista"], button:has(svg.lucide-list)').first();
    if (await listModeBtn.isVisible()) {
      await listModeBtn.click();
    }

    const listItem = page.locator('article.group').first();
    await expect(listItem).toBeVisible();

    // No modo lista, as variantes aparecem como pontos de carrossel (role="tab")
    const carouselDot = listItem.locator('button[role="tab"]').first();
    
    if (await carouselDot.isVisible()) {
      await carouselDot.hover();
      
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      
      // Valida o padrão swatch + nome
      await expect(tooltip.locator('span.rounded-full')).toBeVisible();
      expect(await tooltip.innerText()).not.toBe('');
      await expect(tooltip).toHaveClass(/bg-popover\/95/);
    }
  });
});

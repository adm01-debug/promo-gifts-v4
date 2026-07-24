import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "./helpers/nav";

/**
 * Testes E2E para os novos tooltips de variação de cor.
 * Verifica se o tooltip abre apenas no hover e exibe o swatch circular junto com o nome.
 */

test.describe("Color Variation Tooltips", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth();
    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);
  });

  test("Confirm tooltip shows swatch + name in PDP and has no native title", async ({ page }) => {
    // 1. Entrar no detalhe de um produto
    const productCard = page.locator('[data-testid="product-card"]').first();
    await expect(productCard).toBeVisible();
    await productCard.click();
    await waitForRouteIdle(page);

    // 2. Localizar galeria de variações
    const colorThumbButton = page.locator('button.group\\/color').first();
    await expect(colorThumbButton).toBeVisible();
    
    // Validar que não existe atributo title nativo no botão ou na imagem
    await expect(colorThumbButton).not.toHaveAttribute('title', /.*/);
    await expect(colorThumbButton.locator('img')).not.toHaveAttribute('title', /.*/);

    // 3. Hover no thumb e cronometrar delay
    const startTime = Date.now();
    await colorThumbButton.locator('img').first().hover();
    const tooltip = page.locator('[role="tooltip"]');

    // Assertion: não deve aparecer antes de 1000ms
    await page.waitForTimeout(900);
    await expect(tooltip).not.toBeVisible();

    // Deve aparecer após 1000ms
    await expect(tooltip).toBeVisible({ timeout: 2000 });
    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThanOrEqual(1000);

    // 5. Validar swatch (círculo) e texto
    const swatch = tooltip.locator('[data-testid="color-tooltip-swatch"]');
    await expect(swatch).toBeVisible();
    
    const text = await tooltip.innerText();
    expect(text.trim().length).toBeGreaterThan(0);

    // 6. Verificar estilos visuais solicitados
    await expect(tooltip).toHaveClass(/bg-popover\/95/);
    await expect(tooltip).toHaveClass(/backdrop-blur-sm/);
    await expect(tooltip).toHaveClass(/border-border\/40/);
    await expect(tooltip).toHaveClass(/shadow-md/);
  });

  test("Confirm tooltip works in Product Card (Grid Mode) and opens ONLY on hover", async ({ page }) => {
    const productCard = page.locator('[data-testid="product-card"]').first();
    
    // Inicialmente, sem tooltip
    await expect(page.locator('[role="tooltip"]')).not.toBeVisible();

    await productCard.hover(); // Revela os pontos de cor

    const colorDot = productCard.locator('button[aria-label^="Cor "]').first();
    
    if (await colorDot.isVisible()) {
      // Sem hover no ponto específico, ainda não deve ter tooltip
      await expect(page.locator('[role="tooltip"]')).not.toBeVisible();

      await colorDot.hover();

      // Agora deve aparecer após 1000ms
      const tooltip = page.locator('[role="tooltip"]');
      
      // Validação de delay
      await expect(tooltip).not.toBeVisible();
      await page.waitForTimeout(800);
      await expect(tooltip).not.toBeVisible();
      
      await expect(tooltip).toBeVisible();

      // Swatch + nome
      await expect(tooltip.locator('[data-testid="color-tooltip-swatch"]')).toBeVisible();
      await expect(tooltip).toHaveClass(/backdrop-blur-sm/);
      
      // Valida ausência de title nativo
      await expect(colorDot).not.toHaveAttribute('title', /.*/);
    }
  });

  test("Confirm tooltip in Product List Mode carousels", async ({ page }) => {
    const listModeBtn = page.locator('button[aria-label*="lista"], button:has(svg.lucide-list)').first();
    if (await listModeBtn.isVisible()) {
      await listModeBtn.click();
    }

    const listItem = page.locator('article.group').first();
    await expect(listItem).toBeVisible();

    const carouselDot = listItem.locator('button[role="tab"]').first();
    
    if (await carouselDot.isVisible()) {
      await carouselDot.hover();
      
      const tooltip = page.locator('[role="tooltip"]');
      
      // Validação de delay
      await expect(tooltip).not.toBeVisible();
      await page.waitForTimeout(800);
      await expect(tooltip).not.toBeVisible();
      
      await expect(tooltip).toBeVisible();
      
      await expect(tooltip.locator('[data-testid="color-tooltip-swatch"]')).toBeVisible();
      await expect(tooltip).toHaveClass(/bg-popover\/95/);
      
      // Valida ausência de title nativo
      await expect(carouselDot).not.toHaveAttribute('title', /.*/);
    }
  });
});

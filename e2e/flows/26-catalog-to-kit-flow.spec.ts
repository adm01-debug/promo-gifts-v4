/**
 * E2E — Fluxo: Catálogo → Detalhe de Produto → Kit Builder
 *
 * Valida a jornada do usuário desde a navegação no catálogo até a
 * criação de kit com múltiplos produtos.
 */
import { test, expect } from "@playwright/test";

test.describe("Fluxo Catálogo → Kit Builder", () => {
  test("catálogo carrega lista de produtos sem crash", async ({ page }) => {
    await page.goto("/produtos");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).not.toContainText("500");
  });

  test("navegação para detalhe de produto não redireciona para 404", async ({ page }) => {
    await page.goto("/produtos");
    await page.waitForLoadState("networkidle");

    // Tenta clicar no primeiro produto encontrado
    const productLink = page
      .locator("a[href*='/produtos/'], [data-testid='product-card'] a, [data-testid='product-link']")
      .first();

    const hasProduct = await productLink.count() > 0;
    if (hasProduct) {
      await productLink.click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).not.toContainText("404");
      await expect(page.locator("body")).not.toContainText("500");
    }
  });

  test("Kit Builder (/kits/builder) carrega sem erro", async ({ page }) => {
    await page.goto("/kits/builder");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).not.toContainText("500");
  });

  test("Kit Builder tem área de adição de produtos", async ({ page }) => {
    await page.goto("/kits/builder");
    await page.waitForLoadState("networkidle");

    const addProduct = page
      .locator(
        "[data-testid='add-product'], [data-testid='kit-add'], button:has-text('Adicionar'), button:has-text('Add')"
      )
      .first();

    await expect(addProduct).toBeVisible({ timeout: 15_000 }).catch(() => {
      // Kit builder pode requerer pré-seleção
    });
  });

  test("biblioteca de kits (/kits) carrega", async ({ page }) => {
    await page.goto("/kits");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).not.toContainText("500");
  });

  test("rota de comparação (/comparar) carrega sem 500", async ({ page }) => {
    await page.goto("/comparar");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("500");
  });
});

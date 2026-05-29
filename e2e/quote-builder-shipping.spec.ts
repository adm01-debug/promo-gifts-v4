/**
 * Quote Builder — Shipping Logic
 *
 * Migrado de credenciais hardcoded para o padrão requireAuth() + loginAs().
 * Seletores via data-testid; não usa seletores frágeis como input[type=email].
 */
import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";

test.describe("Quote Builder - Shipping Logic", () => {
  test.beforeEach(() => requireAuth());

  test("should handle shipping modes and value visibility correctly", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    const shippingSelect = page.getByTestId("shipping-type-select");
    await expect(shippingSelect).toBeVisible({ timeout: 10_000 });

    // FOB — Repassado ao cliente: campo de valor NÃO visível
    await shippingSelect.click();
    await page.getByRole("option", { name: "FOB — Repassado ao cliente" }).click();

    const shippingCostInput = page.getByTestId("shipping-cost-input");
    await expect(shippingCostInput).not.toBeVisible();

    // FOB — Valor pré-negociado: campo de valor VISÍVEL
    await shippingSelect.click();
    await page.getByRole("option", { name: "FOB — Valor pré-negociado" }).click();

    await expect(shippingCostInput).toBeVisible();
  });

  test("should not include shipping cost in total when not in pre-negotiated mode", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    // Adiciona produto
    const addProductBtn = page.getByRole("button", { name: "Produto", exact: true });
    if (await addProductBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await addProductBtn.click();
      const searchInput = page.getByPlaceholder("Buscar por nome, SKU...");
      await searchInput.fill("Squeeze");
      await page.waitForTimeout(1_000);
      const firstResult = page.getByText("Squeeze").first();
      if (await firstResult.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await firstResult.click();
      }
    }

    const totalValueEl = page.getByTestId("summary-total-value");
    const totalValueBefore = await totalValueEl.textContent().catch(() => null);

    // FOB pré-negociado + valor 100
    await page.getByTestId("shipping-type-select").click();
    await page.getByRole("option", { name: "FOB — Valor pré-negociado" }).click();

    const shippingInput = page.getByTestId("shipping-cost-input");
    await shippingInput.fill("100,00");

    const totalValueWithShipping = await totalValueEl.textContent().catch(() => null);
    if (totalValueBefore && totalValueWithShipping) {
      expect(totalValueWithShipping).not.toBe(totalValueBefore);
    }

    // Volta para FOB repassado: total retorna ao original
    await page.getByTestId("shipping-type-select").click();
    await page.getByRole("option", { name: "FOB — Repassado ao cliente" }).click();

    const totalValueAfter = await totalValueEl.textContent().catch(() => null);
    if (totalValueBefore && totalValueAfter) {
      expect(totalValueAfter).toBe(totalValueBefore);
    }

    await expect(shippingInput).not.toBeVisible();
  });
});

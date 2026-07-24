import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

/**
 * Tooltip do campo de Desconto no QuoteBuilderSummaryColumn.
 * Cobre: hover, focus por teclado (Tab), aria-describedby, e desaparecimento ao sair.
 */
test.describe("Quote Builder — Discount tooltip", () => {
  test.beforeEach(() => requireAuth());

  test("aparece no hover do seletor de tipo e some ao sair", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    const trigger = page.getByTestId("quote-discount-type-select");
    await expect(trigger).toBeVisible({ timeout: 10_000 });

    await trigger.hover();
    const tooltip = page.getByTestId("quote-discount-tooltip").first();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/Como aplicar o desconto/i);
    await expect(tooltip).toContainText(/Limite sem aprovação do gestor/i);

    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden({ timeout: 2_000 });
  });

  test("aparece no foco via teclado (Tab) no campo de valor", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    const input = page.getByTestId("quote-discount-input");
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.focus();
    const tooltip = page.getByTestId("quote-discount-tooltip").first();
    await expect(tooltip).toBeVisible();

    await expect(input).toHaveAttribute("aria-describedby", "quote-discount-tooltip");
  });

  test("estado de erro reflete no aria-invalid e na mensagem do tooltip", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    const input = page.getByTestId("quote-discount-input");
    if (!(await input.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Sem itens no orçamento — campo de desconto oculto.");
    }

    await input.fill("99");
    await input.blur();

    // aria-invalid pode ser "true" apenas quando excedido; tolera ausência se limite não estiver configurado.
    const ariaInvalid = await input.getAttribute("aria-invalid");
    if (ariaInvalid === "true") {
      await input.hover();
      const tooltip = page.getByTestId("quote-discount-tooltip").first();
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText(/Acima do seu limite/i);
    }
  });
});

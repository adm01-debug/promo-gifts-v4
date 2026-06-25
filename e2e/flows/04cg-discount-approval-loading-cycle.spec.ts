/**
 * E2E — Estados de loading do submit (sucesso e falha).
 *
 * Complementa `04ce` cobrindo o ciclo COMPLETO do botão:
 *   • Cenário sucesso: enabled → disabled (loading) → redirect (botão sai do
 *     DOM). Garante que não fica preso em disabled após sucesso.
 *   • Cenário falha: enabled → disabled (loading) → enabled novamente após
 *     receber 500. Garante que o usuário pode retentar sem reabrir o dialog.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";

test.describe.configure({ mode: "parallel" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

async function setupDialog(page: import("@playwright/test").Page) {
  await gotoAndSettle(page, "/orcamentos/novo");
  await waitForTestIdVisible(page, "quote-wizard", { timeout: 15_000 });
  await page.locator('[data-testid="company-search-input"]').first().click();
  await page.locator(Sel.quote.noCompanyOption).first().click();
  await page.locator(Sel.quote.addProductButton).first().click();
  await page.locator(Sel.quote.productSearchInput).first().waitFor({ state: "visible" });
  const productCount = await page.locator(Sel.quote.productSearchOption).count();
  test.skip(productCount === 0, "Catálogo vazio");
  await page.locator(Sel.quote.productSearchOption).first().click();
  const noColor = page.locator(Sel.quote.addWithoutColor).first();
  if (await noColor.isVisible().catch(() => false)) await noColor.click();
  await page.locator(Sel.quote.item(0)).first().waitFor({ state: "visible" });

  const discountInput = page.locator(Sel.quote.discountInput).first();
  await discountInput.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("75");
  await page.keyboard.press("Tab");

  const btn = page.locator(Sel.quote.requestApprovalButton).first();
  const shown = await btn.isVisible({ timeout: 5_000 }).catch(() => false);
  test.skip(!shown, "Vendedor sem alçada");
  await btn.click();
  await waitForTestIdVisible(page, "quote-approval-dialog", { timeout: 10_000 });
  await page.locator(Sel.quote.approvalJustification).first().fill("E2E loading cycle");
}

test.describe("Discount approval — ciclo completo de loading", () => {
  test.beforeEach(() => requireAuth());

  test("sucesso: enabled → disabled → sai da tela", async ({ page }) => {
    test.setTimeout(60_000);
    await page.route(/\/rest\/v1\/discount_approval_requests/, async (route, request) => {
      if (request.method() === "POST") await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await setupDialog(page);
    const submit = page.locator(Sel.quote.approvalSubmit).first();
    await expect(submit).toBeEnabled({ timeout: 5_000 });
    await submit.click();
    await expect(submit).toBeDisabled({ timeout: 2_000 });
    await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/, { timeout: 25_000 });
  });

  test("falha: enabled → disabled → enabled novamente após 500", async ({ page }) => {
    test.setTimeout(60_000);
    await page.route(/\/rest\/v1\/discount_approval_requests/, async (route, request) => {
      if (request.method() === "POST") {
        await new Promise((r) => setTimeout(r, 600));
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "simulated", code: "PGRST500" }),
        });
        return;
      }
      await route.continue();
    });
    await setupDialog(page);
    const submit = page.locator(Sel.quote.approvalSubmit).first();
    await expect(submit).toBeEnabled({ timeout: 5_000 });
    await submit.click();
    await expect(submit).toBeDisabled({ timeout: 2_000 });
    // Após erro, botão deve voltar a enabled para nova tentativa.
    await expect(submit).toBeEnabled({ timeout: 10_000 });
  });
});

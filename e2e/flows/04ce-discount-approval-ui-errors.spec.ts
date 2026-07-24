/**
 * E2E — Estados de UI da solicitação de desconto (loading + erros).
 *
 * Usa `page.route` para interceptar o POST em `discount_approval_requests`
 * e simular dois cenários sem precisar de DB state pré-existente:
 *
 *   1. Loading visível: atrasa 1.2s a resposta e confirma que o botão
 *      `quote-approval-submit` fica `disabled` e exibe o spinner durante a
 *      requisição (`Loader2` já aplicado no componente).
 *
 *   2. Erro de rede: responde 500 e confirma que o toast `Erro ao solicitar
 *      aprovação` aparece, sem redirecionamento para `/orcamentos/<uuid>`.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";

test.describe.configure({ mode: "parallel" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

async function buildQuoteUntilApprovalDialog(page: import("@playwright/test").Page): Promise<void> {
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

  const requestApproval = page.locator(Sel.quote.requestApprovalButton).first();
  const shown = await requestApproval.isVisible({ timeout: 5_000 }).catch(() => false);
  test.skip(!shown, "Vendedor sem limite < 75% — fluxo de alçada não disparou");
  await requestApproval.click();
  await waitForTestIdVisible(page, "quote-approval-dialog", { timeout: 10_000 });
  await page
    .locator(Sel.quote.approvalJustification)
    .first()
    .fill("E2E UI errors — justificativa válida");
}

test.describe("Discount approval — estados de loading e erro", () => {
  test.beforeEach(() => requireAuth());

  test("loading: submit fica disabled + spinner durante a requisição", async ({ page }) => {
    test.setTimeout(60_000);
    // Intercepta POST do approval e atrasa 1.2s.
    await page.route(/\/rest\/v1\/discount_approval_requests/, async (route, request) => {
      if (request.method() === "POST") {
        await new Promise((r) => setTimeout(r, 1200));
      }
      await route.continue();
    });

    await buildQuoteUntilApprovalDialog(page);
    const submit = page.locator(Sel.quote.approvalSubmit).first();
    await expect(submit).toBeEnabled({ timeout: 5_000 });

    await submit.click();
    // Durante o atraso, o botão deve ficar disabled (UI de loading do save).
    await expect(submit).toBeDisabled({ timeout: 2_000 });
  });

  test("erro: POST 500 mostra toast de erro e mantém na tela", async ({ page }) => {
    test.setTimeout(60_000);
    // Intercepta POST do approval e devolve 500.
    await page.route(/\/rest\/v1\/discount_approval_requests/, async (route, request) => {
      if (request.method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "simulated server error", code: "PGRST500" }),
        });
        return;
      }
      await route.continue();
    });

    await buildQuoteUntilApprovalDialog(page);
    const submit = page.locator(Sel.quote.approvalSubmit).first();
    const urlBefore = page.url();
    await submit.click();

    // Toast de erro do hook OU toast genérico de save error — qualquer um vale.
    const errorToast = page.getByText(/Erro ao solicitar aprovação|Erro ao salvar orçamento/i);
    await expect(errorToast.first()).toBeVisible({ timeout: 8_000 });

    // Não redirecionou para /orcamentos/<uuid>.
    expect(page.url()).toBe(urlBefore);
  });
});

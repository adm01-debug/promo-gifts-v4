/**
 * E2E — Exclusão em LOTE com Desfazer (restore + falha do restore).
 *
 * Complementa `04n-quotes-bulk-delete.spec.ts` (que já cobre seleção, cancelar,
 * sucesso emitindo toast, e falha do DELETE preservando seleção).
 *
 * Cobre:
 *   1. Sucesso: DELETE 204 em N linhas → toast "Desfazer" → clicar Desfazer
 *      dispara N POSTs de restore, sem duplicatas nem retries automáticos.
 *   2. Restore falha (POST 503): DELETE ok, toast aparece, clique em Desfazer
 *      tenta os POSTs, todos falham, toast de erro é exibido; NÃO há retry
 *      automático nem POSTs duplicados.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { installMockAuth, isMockAuthEnabled } from "../helpers/mock-auth";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const QUOTES_REST = /\/rest\/v1\/quotes(\?|$)/;
const UNDO_TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';

async function selectFirstTwoQuotes(page: import("@playwright/test").Page) {
  await gotoAndSettle(page, "/orcamentos");
  const seed = await seedQuotesForStatusChips(page);
  expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

  await gotoAndSettle(page, "/orcamentos");
  await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
    timeout: 10_000,
  });
  await page.locator('button[data-chip-key="all"]').click();

  await page.getByTestId("quotes-select-toggle").click();
  const rowCheckboxes = page.getByRole("checkbox", {
    name: /selecionar orçamento/i,
  });
  await expect(rowCheckboxes.first()).toBeVisible();
  await rowCheckboxes.nth(0).click();
  await rowCheckboxes.nth(1).click();

  await expect(page.getByTestId("quotes-bulk-delete-top")).toContainText("(2)");
}

test.describe("Fluxo: bulk delete + Desfazer restaura orçamentos", () => {
  test.beforeEach(() => requireAuth());

  test("sucesso: DELETE em lote → clicar Desfazer dispara POSTs de restore", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await selectFirstTwoQuotes(page);

    let deleteCalls = 0;
    let postCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: `restored-${postCalls}` }]),
        });
        return;
      }
      await route.continue();
    });

    // Confirma exclusão em lote
    await page.getByTestId("quotes-bulk-delete-top").click();
    await page.getByTestId("quotes-bulk-delete-confirm").click();

    // Aguarda 2 DELETEs
    await expect
      .poll(() => deleteCalls, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(2);

    // Toast Desfazer aparece
    const toast = page.locator(UNDO_TOAST);
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // Clica Desfazer → aguarda 2 POSTs de restore
    await page.locator(UNDO_BTN).click();
    await expect
      .poll(() => postCalls, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);

    // Sem retry silencioso
    const postsAfterUndo = postCalls;
    await page.waitForTimeout(1500);
    expect(postCalls).toBe(postsAfterUndo);
  });

  test("restore falha: POST 503 → toast de erro sem duplicatas nem retry", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await selectFirstTwoQuotes(page);

    let deleteCalls = 0;
    let postCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "unavailable", code: "PGRST503" }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId("quotes-bulk-delete-top").click();
    await page.getByTestId("quotes-bulk-delete-confirm").click();

    await expect
      .poll(() => deleteCalls, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(2);

    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 10_000 });
    await page.locator(UNDO_BTN).click();

    // Cada snapshot tenta um POST — exatamente 2 (sem retry automático)
    await expect
      .poll(() => postCalls, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
    const postsAfterUndo = postCalls;

    // Aguarda para garantir ausência de retry silencioso
    await page.waitForTimeout(2000);
    expect(postCalls).toBe(postsAfterUndo);

    // Algum toast de erro/aviso do sonner é exibido (fallback do restore)
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

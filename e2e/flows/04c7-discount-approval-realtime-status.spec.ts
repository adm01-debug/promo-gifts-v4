/**
 * E2E — Status muda em tempo real (sem reload) quando outra sessão decide.
 * Duas BrowserContexts paralelas; seed compartilhado via setupDiscountAdmin
 * (idempotente — segundo contexto não duplica). Asserções via `data-status`
 * (nunca via texto renderizado).
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";

test.describe.configure({ mode: "parallel" });

test.describe("Discount approval — atualização de status sem reload", () => {
  test("aprovação em outra sessão reflete na timeline aberta", async ({
    browser,
  }, testInfo) => {
    requireAdmin();

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    // Seed via contexto A (idempotente — B reaproveita o pending criado).
    const { seed } = await setupDiscountAdmin(pageA, testInfo, { minPending: 1 });
    if (seed.skipped && seed.pendingTotal === 0) {
      await ctxA.close();
      await ctxB.close();
      test.skip(true, `Sem pending e seed falhou: ${seed.skipped}`);
    }
    // Contexto B: login + navegar (sem novo seed — reaproveita o de A).
    await setupDiscountAdmin(pageB, testInfo, { minPending: 0 });

    const firstPending = pageA
      .locator('[data-testid^="discount-request-card-"][data-status="pending"]')
      .first();
    await expect(firstPending).toBeVisible({ timeout: 10_000 });

    const requestId = (await firstPending.getAttribute("data-testid"))?.replace(
      "discount-request-card-",
      "",
    );
    test.skip(!requestId, "data-testid sem id parseável");

    await gotoAndSettle(pageA, `/admin/aprovacoes-desconto/${requestId}`);
    const statusA = pageA.locator('[data-testid="discount-request-status"]');
    await expect(statusA).toHaveAttribute("data-status", "pending", { timeout: 5_000 });

    await gotoAndSettle(pageB, "/admin/usuarios?tab=discounts");
    const approveB = pageB.getByTestId(`discount-approve-${requestId}`);
    await expect(approveB).toBeVisible({ timeout: 10_000 });
    await approveB.click();

    // Sessão A: status muda sem reload — assert via data-status (sem texto).
    await expect(statusA).toHaveAttribute("data-status", "approved", { timeout: 35_000 });

    await ctxA.close();
    await ctxB.close();
  });
});

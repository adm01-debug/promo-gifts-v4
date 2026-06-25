/**
 * E2E — Status muda em tempo real (sem reload) quando outra sessão decide.
 * Estratégia: duas BrowserContexts paralelas (sessão vendedor + sessão gestor).
 *   1. Vendedor abre /admin/aprovacoes-desconto/:id (read-only se não-admin) OU
 *      gestor abre detalhe em uma aba.
 *   2. Outra aba do gestor aprova/rejeita via fila.
 *   3. Primeira aba reflete novo status sem F5 (via realtime ou polling).
 *
 * Modo defensivo: skip se faltam credenciais admin OU se não houver request pendente.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";
import { seedDiscountApprovalRequestsFromPage } from "../helpers/discount-approval-seed-page";

test.describe("Discount approval — atualização de status sem reload", () => {
  test("aprovação em outra sessão reflete na timeline aberta", async ({ browser }) => {
    requireAdmin();
    const email = process.env.E2E_ADMIN_EMAIL!;
    const password = process.env.E2E_ADMIN_PASSWORD!;

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await loginViaUI(pageA, { email, password });
    await loginViaUI(pageB, { email, password });

    // Garante pelo menos 1 pending via seed idempotente.
    await gotoAndSettle(pageA, "/admin/usuarios?tab=discounts");
    const seed = await seedDiscountApprovalRequestsFromPage(pageA, { minPending: 1 });
    if (seed.skipped && seed.pendingTotal === 0) {
      test.skip(true, `Sem pending e seed falhou: ${seed.skipped}`);
    }
    await gotoAndSettle(pageA, "/admin/usuarios?tab=discounts");

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
    await expect(statusA).toContainText(/pendente|pending/i, { timeout: 5_000 });

    await gotoAndSettle(pageB, "/admin/usuarios?tab=discounts");
    const approveB = pageB.getByTestId(`discount-approve-${requestId}`);
    await expect(approveB).toBeVisible({ timeout: 10_000 });
    await approveB.click();
    const confirmB = pageB.getByRole("button", { name: /confirmar|sim/i }).first();
    if (await confirmB.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmB.click();
    }

    // Sessão A: status atualiza sem reload (realtime/polling ≤ 35s)
    await expect(statusA).toContainText(/aprovado|approved/i, { timeout: 35_000 });

    await ctxA.close();
    await ctxB.close();
  });
});

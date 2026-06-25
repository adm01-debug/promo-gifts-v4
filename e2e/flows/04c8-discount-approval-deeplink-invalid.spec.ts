/**
 * E2E — Deep-link de notificação para um request inexistente/inválido.
 * Garante mensagem clara "Solicitação não encontrada" e CTA de retorno
 * — 100% via data-testid/data-status, sem depender de texto.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";
import { gotoAndSettle } from "../helpers/nav";


test.describe.configure({ mode: "parallel" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const BOGUS_ID = "00000000-0000-0000-0000-000000000000";

test.describe("Discount approval — deep-link inválido", () => {
  test("admin que abre /admin/aprovacoes-desconto/<bogus> vê estado not-found determinístico", async ({
    page,
  }, testInfo) => {
    requireAdmin();
    await setupDiscountAdmin(page, testInfo, { minPending: 0 });

    await gotoAndSettle(page, `/admin/aprovacoes-desconto/${BOGUS_ID}`);

    // Container de detalhe NÃO deve aparecer.
    await expect(
      page.locator('[data-testid="discount-request-detail"]'),
    ).toHaveCount(0, { timeout: 5_000 });

    // Estado not-found com data-status determinístico.
    const notFound = page.getByTestId("discount-request-not-found");
    await expect(notFound).toBeVisible({ timeout: 5_000 });
    await expect(notFound).toHaveAttribute("data-status", "not-found");

    // CTA de retorno presente (sem ler texto).
    await expect(page.getByTestId("discount-request-back")).toBeVisible();
    await expect(page.getByTestId("discount-request-not-found-message")).toBeVisible();

    // URL permanece — sem redirect silencioso.
    expect(page.url()).toContain(`/admin/aprovacoes-desconto/${BOGUS_ID}`);
  });
});

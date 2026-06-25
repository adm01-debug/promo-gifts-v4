/**
 * E2E — Deep-link de notificação para um request inexistente/inválido.
 * Garante mensagem clara "Solicitação não encontrada" e botão de retorno
 * para a fila — sem depender de toast ou redirect implícito.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";
import { gotoAndSettle } from "../helpers/nav";

const BOGUS_ID = "00000000-0000-0000-0000-000000000000";

test.describe("Discount approval — deep-link inválido", () => {
  test("admin que abre /admin/aprovacoes-desconto/<bogus> vê mensagem e CTA de volta", async ({
    page,
  }, testInfo) => {
    requireAdmin();
    await setupDiscountAdmin(page, testInfo, { minPending: 0 });

    await gotoAndSettle(page, `/admin/aprovacoes-desconto/${BOGUS_ID}`);

    // Container determinístico de detalhe NÃO deve aparecer.
    await expect(
      page.locator('[data-testid="discount-request-detail"]'),
    ).toHaveCount(0, { timeout: 5_000 });

    // Mensagem exata exibida pelo DiscountRequestDetailPage.
    await expect(page.getByText(/solicitação não encontrada/i)).toBeVisible({
      timeout: 5_000,
    });

    // CTA "Voltar / Fila de aprovações" presente.
    const backBtn = page.getByRole("button", { name: /voltar|fila de aprovações/i });
    await expect(backBtn.first()).toBeVisible();

    // URL permanece no detalhe (sem redirect silencioso).
    expect(page.url()).toContain(`/admin/aprovacoes-desconto/${BOGUS_ID}`);
  });
});

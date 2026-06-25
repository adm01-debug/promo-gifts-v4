/**
 * E2E — Vendedor (não-admin) NÃO pode acessar /admin/aprovacoes-desconto/:id.
 * Aceita qualquer um dos comportamentos defensivos:
 *   (a) Redirect para fora da rota admin (AdminRoute guard)
 *   (b) Mensagem de acesso restrito renderizada
 *   (c) Permanência em /login se a sessão não está hidratada
 */
import { test, expect } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("Discount approval — vendedor bloqueado em /admin/aprovacoes-desconto/:id", () => {
  test("vendedor não acessa página de detalhe de request", async ({ page }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      "Credenciais E2E_USER_* ausentes",
    );
    test.skip(
      !!process.env.E2E_USER_IS_ADMIN,
      "E2E_USER_IS_ADMIN=true — verificação de bloqueio não aplicável",
    );

    await loginAs(page, "user");
    await gotoAndSettle(
      page,
      "/admin/aprovacoes-desconto/00000000-0000-0000-0000-000000000000",
    );

    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    const onDetail = /\/admin\/aprovacoes-desconto\//.test(url);

    if (!onDetail) {
      // (a) ou (c) — redirect para fora da rota admin (ok)
      expect(onDetail).toBe(false);
      return;
    }

    // (b) — ainda em /detail: deve mostrar acesso restrito (sem container admin)
    const detailVisible = await page
      .locator('[data-testid="discount-request-detail"]')
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    expect(detailVisible).toBe(false);

    const restrictedVisible = await page
      .locator(Sel.app.accessDenied)
      .or(page.getByText(/acesso restrito|sem permissão|não autorizado/i))
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    expect(restrictedVisible).toBe(true);
  });
});

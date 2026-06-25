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
    const onDetail = /\/admin\/aprovacoes-desconto\/[0-9a-f-]+/i.test(url);

    if (!onDetail) {
      // (a) Redirect: deve aterrissar em /login, / ou rota não-admin
      expect(url).not.toMatch(/\/admin\/aprovacoes-desconto\//);
      expect(url).toMatch(/\/(login|acesso-negado|$)/);
      return;
    }

    // (b) Ainda em /detail: nenhum container admin deve renderizar
    const detailVisible = await page
      .locator('[data-testid="discount-request-detail"]')
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    expect(detailVisible).toBe(false);

    // Mensagem exata de bloqueio (padrão AdminRoute / AccessDenied)
    const restrictedLocator = page
      .locator(Sel.app.accessDenied)
      .or(page.getByText(/acesso restrito|acesso negado|sem permissão|não autorizado/i))
      .first();
    await expect(restrictedLocator).toBeVisible({ timeout: 5_000 });
    const text = (await restrictedLocator.textContent())?.toLowerCase() ?? "";
    expect(text).toMatch(/acesso|permiss|autoriz/);
  });
});

/**
 * E2E — Vendedor (não-admin) NÃO pode acessar /admin/aprovacoes-desconto/:id.
 * 100% determinístico via data-testid/data-status — sem leitura de texto.
 *
 * Aceita 2 comportamentos válidos:
 *   (a) Redirect: URL sai de /admin/aprovacoes-desconto/.
 *   (b) Permanência: render do `app-access-denied` (AdminRoute guard inline)
 *       e ausência do `discount-request-detail`.
 */
import { test, expect } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { DiscountApprovalPO } from "../helpers/discount-approval-po";

const BOGUS_ID = "00000000-0000-0000-0000-000000000000";

test.describe.configure({ mode: "parallel" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

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
    await gotoAndSettle(page, `/admin/aprovacoes-desconto/${BOGUS_ID}`);
    await page.waitForLoadState("domcontentloaded");

    const po = new DiscountApprovalPO(page);
    const url = page.url();
    const onDetail = /\/admin\/aprovacoes-desconto\/[0-9a-f-]+/i.test(url);

    if (!onDetail) {
      // (a) Redirect — guard funcionou. URL final esperada: /login, /, ou /acesso-negado.
      expect(url).not.toMatch(/\/admin\/aprovacoes-desconto\//);
      expect(url).toMatch(/\/(login|acesso-negado|$)/);
      return;
    }

    // (b) Permaneceu na rota: container admin NUNCA pode renderizar.
    await expect(po.detailContainer).toHaveCount(0, { timeout: 5_000 });

    // E o guard inline deve expor `app-access-denied` via testid (sem ler texto).
    await expect(page.locator(Sel.app.accessDenied)).toBeVisible({ timeout: 5_000 });
  });
});

/**
 * E2E — Página de detalhes da solicitação de aprovação de desconto.
 * Rota: `/admin/aprovacoes-desconto/:id`.
 *
 * 100% determinístico via data-testid + data-status.
 * Aceita 3 caminhos válidos sem ler texto da página:
 *   (a) AdminRoute redirecionou — URL fora da rota admin.
 *   (b) Admin com pending real → container detail + status="pending".
 *   (c) Sem pedido válido → container not-found + status="not-found".
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { DiscountApprovalPO } from "../helpers/discount-approval-po";

const BOGUS_ID = "00000000-0000-0000-0000-000000000000";

test.describe.configure({ mode: "parallel" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

test.describe("Discount approval — detail page & permissions", () => {
  test.beforeEach(() => requireAuth());

  test("rota /admin/aprovacoes-desconto/:id rende apenas via data-testid/data-status", async ({
    page,
  }) => {
    await gotoAndSettle(page, `/admin/aprovacoes-desconto/${BOGUS_ID}`);
    await page.waitForLoadState("domcontentloaded");

    const po = new DiscountApprovalPO(page);
    const isOnDetail = /\/admin\/aprovacoes-desconto\//.test(page.url());

    if (!isOnDetail) {
      // (a) Redirecionado pelo AdminRoute — guard funcionou.
      expect(page.url()).not.toMatch(/\/admin\/aprovacoes-desconto\//);
      return;
    }

    // Espera resolver: detail OR not-found OR access-denied.
    const detail = po.detailContainer;
    const notFound = page.getByTestId("discount-request-not-found");
    const accessDenied = page.getByTestId("app-access-denied");

    await expect(async () => {
      const counts = await Promise.all([
        detail.count(),
        notFound.count(),
        accessDenied.count(),
      ]);
      expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }).toPass({ timeout: 8_000 });

    if ((await detail.count()) > 0) {
      // (b) Admin com request real — valida data-status do badge.
      await expect(po.detailStatus).toBeVisible();
      const status = await po.detailStatus.getAttribute("data-status");
      expect(["pending", "approved", "rejected"]).toContain(status);
      return;
    }

    if ((await notFound.count()) > 0) {
      // (c) Not-found determinístico.
      await expect(notFound).toHaveAttribute("data-status", "not-found");
      await expect(page.getByTestId("discount-request-back")).toBeVisible();
      return;
    }

    // (d) Acesso negado via guard inline.
    await expect(accessDenied).toBeVisible();
  });

  test("deep-link da fila com ?request=<id> não crasha — validado via testids", async ({
    page,
  }) => {
    await gotoAndSettle(
      page,
      `/admin/usuarios?tab=discounts&request=${BOGUS_ID}`,
    );
    await page.waitForLoadState("domcontentloaded");

    // Sem dependência de texto: body presente + nenhum testid de error boundary.
    await expect(page.locator("body")).toBeVisible();
    const errorBoundary = page.locator(
      '[data-testid="error-boundary"], [data-testid="route-error-boundary"]',
    );
    expect(await errorBoundary.count()).toBe(0);
  });
});

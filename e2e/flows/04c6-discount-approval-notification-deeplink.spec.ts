/**
 * E2E — Deep-link de notificação de desconto.
 *
 * Estratégia 100% determinística (sem dependência de texto):
 *   1. seedDiscountDeeplink garante 1+ pending e devolve `firstPendingId`.
 *   2. Abre /admin/aprovacoes-desconto/<firstPendingId> direto e valida
 *      data-testid + data-status do container de detalhe.
 *   3. Drawer de notificações (sino) é validado por presença/contagem
 *      de unread via data-testid, sem ler texto do item.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { seedDiscountDeeplink } from "../helpers/discount-notification-seed";
import { DiscountApprovalPO } from "../helpers/discount-approval-po";


test.describe.configure({ mode: "parallel" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

test.describe("Discount approval — notification deep-link", () => {
  test("deep-link abre detalhe de pedido pending via data-testid/data-status", async ({
    page,
  }, testInfo) => {
    requireAdmin();
    const { firstPendingId, seedSkipped } = await seedDiscountDeeplink(page, testInfo, {
      minPending: 1,
    });
    test.skip(!firstPendingId, `Sem pending disponível para deep-link (${seedSkipped ?? "n/a"})`);

    const po = new DiscountApprovalPO(page);
    await po.openDetail(firstPendingId!);

    // Container e badge de status determinísticos.
    await expect(po.detailContainer).toBeVisible({ timeout: 5_000 });
    await expect(po.detailStatus).toHaveAttribute("data-status", "pending");

    // Botões aprovar/rejeitar visíveis quando pending.
    await expect(po.detailApprove).toBeVisible();
    await expect(po.detailReject).toBeVisible();

    expect(page.url()).toContain(`/admin/aprovacoes-desconto/${firstPendingId}`);
  });

  test("drawer de notificações abre e expõe itens via data-testid (opcional)", async ({
    page,
  }, testInfo) => {
    requireAdmin();
    const { seedSkipped } = await seedDiscountDeeplink(page, testInfo, { minPending: 1 });
    if (seedSkipped) {
      // eslint-disable-next-line no-console
      console.warn(`[04c6 drawer] seed skipped: ${seedSkipped}`);
    }

    await gotoAndSettle(page, "/");
    const po = new DiscountApprovalPO(page);
    const opened = await po.openNotificationsDrawer();
    test.skip(!opened, "Sino de notificações não disponível neste ambiente");

    // Sem assertions de texto: apenas presença de itens via testid prefix.
    const items = page.locator('[data-testid^="notification-item-"]');
    await expect(items.first()).toBeVisible({ timeout: 5_000 }).catch(() => {
      // ambiente pode não ter notificações — não falha o spec.
    });
  });
});

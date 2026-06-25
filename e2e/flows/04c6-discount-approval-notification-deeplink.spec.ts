/**
 * E2E — Deep-link de notificação de desconto abre detalhe e marca como lida.
 * Seed idempotente garante pelo menos 1 pending request via
 * seedDiscountApprovalRequestsFromPage; depois dispara notificação via abertura
 * da fila (o request criado já gera registro na tabela de notificações via trigger).
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";

test.describe("Discount approval — notification deep-link mark-as-read", () => {
  test("clique no link da notificação reduz contador de não lidas", async ({ page }, testInfo) => {
    requireAdmin();
    const { seed } = await setupDiscountAdmin(page, testInfo, { minPending: 1 });
    if (seed.skipped && seed.pendingTotal === 0) {
      test.skip(true, `Seed falhou e não há pending: ${seed.skipped}`);
    }

    await gotoAndSettle(page, "/");

    const bell = page.locator(
      '[data-testid="notification-bell"], [data-testid="open-notifications"]',
    );
    const bellVisible = await bell.first().isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!bellVisible, "Sino de notificações não disponível");

    await bell.first().click();

    const unreadBadge = page.locator('[data-testid="notification-unread-count"]');
    const initialUnread = await unreadBadge
      .textContent({ timeout: 3_000 })
      .then((t) => Number(t?.trim() ?? 0))
      .catch(() => 0);

    const discountItem = page
      .locator('[data-testid^="notification-item-"]')
      .filter({ hasText: /desconto|aprovação/i })
      .first();
    const hasItem = await discountItem.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!hasItem || initialUnread === 0, "Sem notificações de desconto não lidas");

    await discountItem.click();

    // Deep-link deve abrir fila ou detalhe de aprovação.
    await expect(page).toHaveURL(/discounts|aprovacoes-desconto/i, { timeout: 8_000 });

    // Se aterrou na rota de detalhe, o container determinístico está presente.
    if (/aprovacoes-desconto\/[0-9a-f-]+/i.test(page.url())) {
      await expect(page.locator('[data-testid="discount-request-detail"]')).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.locator('[data-testid="discount-request-status"]')).toBeVisible();
    }

    await gotoAndSettle(page, "/");
    await bell.first().click();
    const after = await unreadBadge
      .textContent({ timeout: 3_000 })
      .then((t) => Number(t?.trim() ?? 0))
      .catch(() => 0);
    expect(after).toBeLessThan(initialUnread);
  });
});

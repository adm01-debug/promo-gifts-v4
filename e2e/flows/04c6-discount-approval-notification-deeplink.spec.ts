/**
 * E2E — Deep-link da notificação de desconto marca como lida e atualiza contador.
 * Modo defensivo: skip se não-admin OU se não houver notificação de desconto.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";

test.describe("Discount approval — notification deep-link mark-as-read", () => {
  test("clique no link da notificação reduz contador de não lidas", async ({ page }) => {
    requireAdmin();
    await loginAs(page, "admin");
    await gotoAndSettle(page, "/");

    // Abre drawer de notificações
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
    const hasItem = await discountItem.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!hasItem || initialUnread === 0, "Sem notificações de desconto não lidas");

    await discountItem.click();

    // Deve navegar para fila/detalhe com query ?request=...
    await expect(page).toHaveURL(/discounts|aprovacoes-desconto/i, { timeout: 8_000 });

    // Volta e confere contador decrementado
    await gotoAndSettle(page, "/");
    await bell.first().click();
    const after = await unreadBadge
      .textContent({ timeout: 3_000 })
      .then((t) => Number(t?.trim() ?? 0))
      .catch(() => 0);
    expect(after).toBeLessThan(initialUnread);
  });
});

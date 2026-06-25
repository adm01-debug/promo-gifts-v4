/**
 * DiscountApprovalPO — page-object para a fila de aprovação de desconto.
 *
 * SSOT para selectors determinísticos (todos por `data-testid`) e ações
 * comuns (aprovar/rejeitar, abrir detalhe, ler status sem depender de texto).
 *
 * Estados refletidos via `data-status` no card e no badge da página de detalhe:
 *   - "pending"   → botões aprovar/rejeitar habilitados
 *   - "approved"  → botões desabilitados; status visual via atributo
 *   - "rejected"  → idem
 *
 * Trace/screenshot em falha já configurados globalmente em playwright.config.ts
 * (`trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`).
 */
import { expect, type Page, type Locator } from "@playwright/test";
import { gotoAndSettle } from "./nav";

export type DiscountStatus = "pending" | "approved" | "rejected";

export class DiscountApprovalPO {
  constructor(private readonly page: Page) {}

  // ---------- Navegação ----------
  async openQueue(): Promise<void> {
    await gotoAndSettle(this.page, "/admin/usuarios?tab=discounts");
  }

  async openDetail(requestId: string): Promise<void> {
    await gotoAndSettle(this.page, `/admin/aprovacoes-desconto/${requestId}`);
    await expect(this.detailContainer).toBeVisible({ timeout: 5_000 });
  }

  // ---------- Selectors (todos via data-testid) ----------
  card(id: string): Locator {
    return this.page.locator(`[data-testid="discount-request-card-${id}"]`);
  }

  cardStatus(id: string): Locator {
    return this.page.locator(`[data-testid="discount-request-status-${id}"]`);
  }

  approveButton(id: string): Locator {
    return this.page.getByTestId(`discount-approve-${id}`);
  }

  rejectButton(id: string): Locator {
    return this.page.getByTestId(`discount-reject-${id}`);
  }

  get loadMore(): Locator {
    return this.page.getByTestId("discount-queue-load-more");
  }

  get detailContainer(): Locator {
    return this.page.locator('[data-testid="discount-request-detail"]');
  }

  get detailStatus(): Locator {
    return this.page.locator('[data-testid="discount-request-status"]');
  }

  get detailApprove(): Locator {
    return this.page.getByTestId("discount-request-approve");
  }

  get detailReject(): Locator {
    return this.page.getByTestId("discount-request-reject");
  }

  // ---------- Drawer de notificações ----------
  async openNotificationsDrawer(): Promise<boolean> {
    const bell = this.page
      .locator('[data-testid="notification-bell"], [data-testid="open-notifications"]')
      .first();
    const visible = await bell.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return false;
    await bell.click();
    return true;
  }

  // ---------- Ações de alto nível ----------
  async firstPendingId(): Promise<string | null> {
    const card = this.page
      .locator('[data-testid^="discount-request-card-"][data-status="pending"]')
      .first();
    const ok = await card.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!ok) return null;
    const tid = (await card.getAttribute("data-testid")) ?? "";
    return tid.replace("discount-request-card-", "") || null;
  }

  /**
   * Espera a resposta REST da mutation PATCH em `discount_approval_requests`
   * (ok=200/204). Reduz flakiness ao não depender só da invalidação do cache
   * react-query — confirma que a transição foi persistida no backend.
   */
  private waitForMutationResponse(timeout = 20_000) {
    return this.page.waitForResponse(
      (res) =>
        /\/rest\/v1\/discount_approval_requests/.test(res.url()) &&
        res.request().method() === "PATCH" &&
        res.ok(),
      { timeout },
    );
  }

  /** Clica em aprovar, espera resposta REST e o card refletir `data-status="approved"`. */
  async approveFromQueue(id: string, timeout = 35_000): Promise<void> {
    await expect(this.approveButton(id)).toBeVisible({ timeout: 10_000 });
    const responsePromise = this.waitForMutationResponse(timeout);
    await this.approveButton(id).click();
    await responsePromise;
    await expect(this.card(id)).toHaveAttribute("data-status", "approved", { timeout });
  }

  /** Clica em recusar, espera resposta REST e o card refletir `data-status="rejected"`. */
  async rejectFromQueue(id: string, timeout = 35_000): Promise<void> {
    await expect(this.rejectButton(id)).toBeVisible({ timeout: 10_000 });
    const responsePromise = this.waitForMutationResponse(timeout);
    await this.rejectButton(id).click();
    await responsePromise;
    await expect(this.card(id)).toHaveAttribute("data-status", "rejected", { timeout });
  }

  /** Assert status atual via `data-status` (sem ler texto). */
  async expectDetailStatus(status: DiscountStatus, timeout = 5_000): Promise<void> {
    await expect(this.detailStatus).toHaveAttribute("data-status", status, { timeout });
  }
}

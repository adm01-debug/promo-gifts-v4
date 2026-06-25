/**
 * E2E — Timeline do detalhe da solicitação de desconto.
 *
 * Valida 100% via data-testid/data-event/data-status:
 *   1. Após approve via página de detalhe (com `admin_notes`), a timeline
 *      contém pelo menos 2 itens na ordem `requested` → `approved`, com o
 *      nome do decisor visível e a nota administrativa presente.
 *   2. Após reject via página de detalhe (com motivo), a timeline contém
 *      a sequência `requested` → `rejected` e o motivo aparece no item.
 *
 * Pré-condição: seed garante 2+ pending; cada caso consome 1.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";
import { DiscountApprovalPO } from "../helpers/discount-approval-po";

test.describe.configure({ mode: "parallel" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

async function decideViaDetail(
  page: import("@playwright/test").Page,
  po: DiscountApprovalPO,
  requestId: string,
  decision: "approve" | "reject",
  notes: string,
): Promise<void> {
  await po.openDetail(requestId);
  await po.expectDetailStatus("pending");
  await page.getByTestId("discount-request-admin-notes").fill(notes);
  const responsePromise = page.waitForResponse(
    (res) =>
      /\/rest\/v1\/discount_approval_requests/.test(res.url()) &&
      res.request().method() === "PATCH" &&
      res.ok(),
    { timeout: 20_000 },
  );
  await page
    .getByTestId(decision === "approve" ? "discount-request-approve" : "discount-request-reject")
    .click();
  await responsePromise;
  await po.expectDetailStatus(decision === "approve" ? "approved" : "rejected", 10_000);
}

async function assertTimelineEvents(
  page: import("@playwright/test").Page,
  requestId: string,
  expectedOrder: ReadonlyArray<"requested" | "approved" | "rejected">,
): Promise<void> {
  const list = page.getByTestId(`discount-audit-list-${requestId}`);
  await expect(list).toBeVisible({ timeout: 10_000 });

  // Ordem cronológica determinística — a query do AuditTrail é
  // `order('created_at', { ascending: true })`. Validamos por data-event.
  await expect(async () => {
    const events = await list.locator("[data-event]").evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-event")),
    );
    expect(events.slice(0, expectedOrder.length)).toEqual([...expectedOrder]);
  }).toPass({ timeout: 10_000 });
}

test.describe("Discount approval — timeline do detalhe", () => {
  test("approve registra requested→approved com decisor e notas", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    requireAdmin();
    const { seed } = await setupDiscountAdmin(page, testInfo, { minPending: 2 });
    test.skip(seed.pendingTotal < 1, "Sem pending para aprovar");

    const po = new DiscountApprovalPO(page);
    await po.openQueue();
    const id = await po.firstPendingId();
    expect(id).not.toBeNull();

    const note = `Aprovado E2E ${testInfo.testId.slice(0, 6)}`;
    await decideViaDetail(page, po, id!, "approve", note);

    await assertTimelineEvents(page, id!, ["requested", "approved"]);

    // Item "approved" exibe nota admin e nome do decisor (não vazio).
    const approvedItem = page.locator(
      `[data-testid="discount-audit-list-${id}"] [data-event="approved"]`,
    );
    await expect(approvedItem).toBeVisible();
    await expect(approvedItem).toContainText(note);
    // <strong> com nome do actor — não validamos texto exato, só presença.
    await expect(approvedItem.locator("strong").first()).not.toHaveText("", { timeout: 5_000 });
  });

  test("reject registra requested→rejected com motivo da rejeição", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    requireAdmin();
    const { seed } = await setupDiscountAdmin(page, testInfo, { minPending: 1 });
    test.skip(seed.pendingTotal < 1, "Sem pending para rejeitar");

    const po = new DiscountApprovalPO(page);
    await po.openQueue();
    const id = await po.firstPendingId();
    expect(id).not.toBeNull();

    const reason = `Rejeitado E2E — fora da política ${testInfo.testId.slice(0, 6)}`;
    await decideViaDetail(page, po, id!, "reject", reason);

    await assertTimelineEvents(page, id!, ["requested", "rejected"]);

    const rejectedItem = page.locator(
      `[data-testid="discount-audit-list-${id}"] [data-event="rejected"]`,
    );
    await expect(rejectedItem).toBeVisible();
    await expect(rejectedItem).toContainText(reason);
    await expect(rejectedItem.locator("strong").first()).not.toHaveText("", { timeout: 5_000 });
  });
});

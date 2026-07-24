/**
 * E2E — Aprovar e rejeitar pedidos via DiscountApprovalPO.
 *
 * Valida ciclo completo 100% por data-testid/data-status:
 *   1. Seed 2+ pending via setupDiscountAdmin.
 *   2. Aprova o 1º pending — card transita para data-status="approved".
 *   3. Rejeita o próximo pending — card transita para data-status="rejected".
 *   4. Abre detalhe de cada um e valida data-status no badge + presença
 *      da timeline (`discount-audit-list-<id>`) sem ler texto.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";
import { DiscountApprovalPO } from "../helpers/discount-approval-po";

test.describe.configure({ mode: "parallel" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

test.describe("Discount approval — aprovar/rejeitar via fila e validar timeline", () => {
  test("aprova e rejeita pedidos pendentes e valida estados via data-status", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    requireAdmin();
    const { seed } = await setupDiscountAdmin(page, testInfo, { minPending: 2 });
    test.skip(
      seed.pendingTotal < 2,
      `Sem pending suficiente para aprovar+rejeitar (${seed.skipped ?? "ok"})`,
    );

    const po = new DiscountApprovalPO(page);
    await po.openQueue();

    // 1) Aprova o primeiro pending. PO valida transição (ou remoção via filtro).
    const approveId = await po.firstPendingId();
    expect(approveId).not.toBeNull();
    await po.approveFromQueue(approveId!);

    // 2) Rejeita o próximo pending.
    const rejectId = await po.firstPendingId();
    expect(rejectId).not.toBeNull();
    expect(rejectId).not.toBe(approveId);
    await po.rejectFromQueue(rejectId!);

    // 3) Abre detalhe do aprovado — badge reflete status + timeline presente.
    await po.openDetail(approveId!);
    await po.expectDetailStatus("approved");
    await expect(
      page.getByTestId(`discount-audit-list-${approveId}`),
    ).toBeVisible({ timeout: 5_000 });

    // 4) Abre detalhe do rejeitado — idem.
    await po.openDetail(rejectId!);
    await po.expectDetailStatus("rejected");
    await expect(
      page.getByTestId(`discount-audit-list-${rejectId}`),
    ).toBeVisible({ timeout: 5_000 });
  });
});

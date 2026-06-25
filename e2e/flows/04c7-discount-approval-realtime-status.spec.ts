/**
 * E2E — Status muda em tempo real (sem reload) quando outra sessão decide.
 * Duas BrowserContexts paralelas + seed compartilhado idempotente.
 * Asserções 100% via `data-status` (zero dependência de texto).
 *
 * Trace + screenshot em falha já habilitados em playwright.config.ts;
 * `test.use` reforça `trace: 'on'` para diagnóstico extra de flakiness.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";
import { DiscountApprovalPO } from "../helpers/discount-approval-po";

test.describe.configure({ mode: "parallel" });
test.use({ trace: "on", screenshot: "only-on-failure" });

test.describe("Discount approval — atualização de status sem reload", () => {
  test("aprovação em outra sessão reflete na timeline aberta", async ({
    browser,
  }, testInfo) => {
    // Realtime/polling pode encostar nos 35s sob carga — folga generosa.
    test.setTimeout(120_000);
    requireAdmin();

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    const { seed } = await setupDiscountAdmin(pageA, testInfo, { minPending: 1 });
    if (seed.skipped && seed.pendingTotal === 0) {
      await ctxA.close();
      await ctxB.close();
      test.skip(true, `Sem pending e seed falhou: ${seed.skipped}`);
    }
    await setupDiscountAdmin(pageB, testInfo, { minPending: 0 });

    const poA = new DiscountApprovalPO(pageA);
    const poB = new DiscountApprovalPO(pageB);

    const requestId = await poA.firstPendingId();
    test.skip(!requestId, "Sem request pending visível após seed");

    await poA.openDetail(requestId!);
    await poA.expectDetailStatus("pending");

    await poB.openQueue();
    await poB.approveFromQueue(requestId!, 40_000);

    // Sessão A: timeline reflete sem reload via polling/realtime.
    await expect(poA.detailStatus).toHaveAttribute("data-status", "approved", {
      timeout: 40_000,
    });

    await ctxA.close();
    await ctxB.close();
  });
});

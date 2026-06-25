/**
 * E2E — Paginação cursorada da fila de aprovações de desconto.
 * Valida:
 *   - Botão "Carregar mais" existe quando há > PAGE_SIZE itens
 *   - Ao clicar, novos cards são anexados sem duplicar IDs
 *   - Ordem por `data-created-at` desc é estritamente monotônica
 *   - Cursor entre páginas é estável (último created_at da página N >= primeiro da página N+1)
 *
 * Seed idempotente: tenta garantir > PAGE_SIZE pending via
 * seedDiscountApprovalRequestsFromPage; se RLS impedir, faz skip claro.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";
import { assertCursorPagination, type PageRow } from "../helpers/pagination-asserts";


test.describe.configure({ mode: "parallel" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const PAGE_SIZE = 50;

test.describe("Discount approval — paginação cursorada da fila", () => {
  test("carregar mais anexa itens sem duplicar e mantém ordem", async ({ page }, testInfo) => {
    // Seed de 55+ pending + 2 fetches paginados podem demorar sob carga.
    test.setTimeout(90_000);
    requireAdmin();
    const { seed } = await setupDiscountAdmin(page, testInfo, {
      minPending: PAGE_SIZE + 5,
    });
    if (seed.skipped) {
      // eslint-disable-next-line no-console
      console.warn(`[04c5] seed skipped: ${seed.skipped}`);
    }
    await gotoAndSettle(page, "/admin/usuarios?tab=discounts");

    const cards = page.locator('[data-testid^="discount-request-card-"]');
    await expect(async () => {
      const c = await cards.count();
      expect(c).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });

    const initialCount = await cards.count();
    test.skip(
      initialCount < PAGE_SIZE,
      `Fila tem ${initialCount} item(ns); seed retornou ${seed.skipped ?? "ok"} — sem dados suficientes`,
    );

    const readRows = async (): Promise<PageRow[]> =>
      cards.evaluateAll((els) =>
        els.map((e) => ({
          id: (e.getAttribute("data-testid") ?? "").replace("discount-request-card-", ""),
          created_at: e.getAttribute("data-created-at") ?? "",
        })),
      );

    const before = await readRows();
    const cursor = before[before.length - 1].created_at;

    const loadMore = page.getByTestId("discount-queue-load-more");
    await expect(loadMore).toBeVisible({ timeout: 5_000 });
    await loadMore.click();

    await expect(async () => {
      const c = await cards.count();
      expect(c).toBeGreaterThan(before.length);
    }).toPass({ timeout: 10_000 });

    const after = await readRows();
    const page2 = after.slice(before.length);

    // Append-only + cursor estável + ordem desc + sem duplicados (helper SSOT).
    expect(after.slice(0, before.length)).toEqual(before);
    assertCursorPagination(before, page2, cursor, "desc");
  });
});



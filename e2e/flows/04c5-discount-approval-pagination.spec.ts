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

const PAGE_SIZE = 50;

test.describe("Discount approval — paginação cursorada da fila", () => {
  test("carregar mais anexa itens sem duplicar e mantém ordem", async ({ page }, testInfo) => {
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

    const idsBefore = await cards.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid") ?? ""),
    );
    const datesBefore = await cards.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-created-at") ?? ""),
    );

    // Ordem desc estritamente monotônica antes do load-more
    for (let i = 1; i < datesBefore.length; i++) {
      expect(
        new Date(datesBefore[i - 1]).getTime(),
        `Ordem quebrada em ${i}: ${datesBefore[i - 1]} < ${datesBefore[i]}`,
      ).toBeGreaterThanOrEqual(new Date(datesBefore[i]).getTime());
    }

    const loadMore = page.getByTestId("discount-queue-load-more");
    await expect(loadMore).toBeVisible({ timeout: 5_000 });
    await loadMore.click();

    await expect(async () => {
      const c = await cards.count();
      expect(c).toBeGreaterThan(initialCount);
    }).toPass({ timeout: 10_000 });

    const idsAfter = await cards.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid") ?? ""),
    );
    const datesAfter = await cards.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-created-at") ?? ""),
    );

    // 1) Sem duplicados entre páginas
    const unique = new Set(idsAfter);
    expect(unique.size).toBe(idsAfter.length);

    // 2) Append-only: prefixo preserva a ordem original
    expect(idsAfter.slice(0, idsBefore.length)).toEqual(idsBefore);

    // 3) Cursor estável: último da página 1 >= primeiro da página 2
    const lastOfPage1 = new Date(datesBefore[datesBefore.length - 1]).getTime();
    const firstOfPage2 = new Date(datesAfter[initialCount]).getTime();
    expect(lastOfPage1).toBeGreaterThanOrEqual(firstOfPage2);

    // 4) Ordem desc global preservada após append
    for (let i = 1; i < datesAfter.length; i++) {
      expect(
        new Date(datesAfter[i - 1]).getTime(),
      ).toBeGreaterThanOrEqual(new Date(datesAfter[i]).getTime());
    }

    // 5) Cursor-token (created_at do último item da página 1) imutável após o append
    const cursorTokenBefore = datesBefore[datesBefore.length - 1];
    const cursorTokenAfterAppend = datesAfter[initialCount - 1];
    expect(cursorTokenAfterAppend).toBe(cursorTokenBefore);

    // 6) Zero interseção entre IDs da página 1 e IDs da página 2
    const page1Ids = new Set(idsBefore);
    const page2Ids = idsAfter.slice(initialCount);
    for (const id of page2Ids) {
      expect(page1Ids.has(id), `Item ${id} apareceu em ambas as páginas`).toBe(false);
    }
  });
});


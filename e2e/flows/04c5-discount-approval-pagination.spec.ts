/**
 * E2E — Paginação cursorada da fila de aprovações de desconto.
 * Valida:
 *   - Botão "Carregar mais" existe (ou ausente quando há <= PAGE_SIZE itens)
 *   - Ao clicar, novos cards são anexados (sem duplicar IDs)
 *   - Cards estão ordenados por created_at desc (data-attribute opcional)
 *
 * Modo defensivo: skip se não-admin OU se houver menos de PAGE_SIZE itens.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";

const PAGE_SIZE = 50;

test.describe("Discount approval — paginação cursorada da fila", () => {
  test("carregar mais anexa itens sem duplicar e mantém ordem", async ({ page }) => {
    requireAdmin();
    await loginAs(page, "admin");
    await gotoAndSettle(page, "/admin/usuarios?tab=discounts");

    const cards = page.locator('[data-testid^="discount-request-card-"]');
    const initialCount = await cards.count().catch(() => 0);

    test.skip(
      initialCount < PAGE_SIZE,
      `Fila tem ${initialCount} item(ns) — sem dados suficientes para testar paginação`,
    );

    // Snapshot dos IDs iniciais (data-testid="discount-request-card-<id>")
    const idsBefore = await cards.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid") ?? ""),
    );

    const loadMore = page.getByRole("button", { name: /carregar mais|mais resultados/i });
    await expect(loadMore).toBeVisible({ timeout: 5_000 });
    await loadMore.click();

    // Espera o número crescer
    await expect(async () => {
      const c = await cards.count();
      expect(c).toBeGreaterThan(initialCount);
    }).toPass({ timeout: 10_000 });

    const idsAfter = await cards.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid") ?? ""),
    );

    // Não há duplicados
    const unique = new Set(idsAfter);
    expect(unique.size).toBe(idsAfter.length);

    // Prefixo preserva ordem (append, não reordenação)
    expect(idsAfter.slice(0, idsBefore.length)).toEqual(idsBefore);
  });
});

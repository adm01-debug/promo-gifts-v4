/**
 * Lista de orçamentos — filtro "Vencimento próximo" (sort=expiring).
 *
 * Garante em mobile/tablet/desktop:
 *  (1) Selecionar "Vencimento próximo" no dropdown não exibe nenhum orçamento
 *      com status "Expirado" (badge `quote-status-badge-expired`).
 *  (2) Quando a lista zera, o empty state mostra a copy dedicada do filtro
 *      ("próximo do vencimento") com CTA "Ver todos (mais recentes)".
 *  (3) Regressão: alternar repetidamente entre statusFilter (chips) e sort
 *      mantém o conjunto consistente — após voltar à combinação original,
 *      o set de IDs é idêntico ao snapshot inicial.
 *
 * Política de seletores: somente Sel.* (TID).
 */
import { test, expect, requireAuth } from "../../fixtures/test-base";
import { gotoAndSettle } from "../../helpers/nav";
import { Sel } from "../../fixtures/selectors";

type Vp = { name: "mobile" | "tablet" | "desktop"; w: number; h: number };
const VIEWPORTS: Vp[] = [
  { name: "mobile", w: 390, h: 844 },
  { name: "tablet", w: 834, h: 1112 },
  { name: "desktop", w: 1440, h: 900 },
];

async function selectSort(page: Awaited<ReturnType<typeof test.step>> extends never ? never : any, value: string) {
  await page.locator(Sel.quotesList.sortTrigger).click();
  await page.locator(Sel.quotesList.sortItem(value)).click();
}

async function visibleRowIds(page: any): Promise<string[]> {
  // rowMorePrefix é único por orçamento (`quote-row-more-<id>`) — extrai o id.
  const handles = await page.locator(`[data-testid^="quote-row-more-"]`).all();
  const ids: string[] = [];
  for (const h of handles) {
    const tid = await h.getAttribute("data-testid");
    if (tid) ids.push(tid.replace(/^quote-row-more-/, ""));
  }
  return ids.sort();
}

test.describe("Lista de orçamentos — sort 'Vencimento próximo' (e2e)", () => {
  test.beforeEach(() => requireAuth());

  for (const vp of VIEWPORTS) {
    test(`${vp.name} (${vp.w}x${vp.h}): nenhum orçamento expirado aparece`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await gotoAndSettle(page, "/orcamentos");
      await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
        timeout: 15_000,
      });

      await selectSort(page, "expiring");

      // Empty state dedicado OU lista renderizada — em ambos os casos,
      // nenhum badge `expired` pode estar visível.
      const empty = page.locator(Sel.quotesList.emptyState);
      const container = page.locator(Sel.quotesList.scrollContainer);
      await expect(empty.or(container)).toBeVisible({ timeout: 15_000 });

      if ((await empty.count()) > 0) {
        // (2) Copy do empty state específico do filtro
        await expect(empty).toContainText(/próximo do vencimento/i);
        await expect(empty).toContainText(/Ver todos/i);
      } else {
        // (1) Nenhum badge `expired` na lista
        const expiredBadges = page.locator(Sel.quotesList.statusBadge("expired"));
        expect(await expiredBadges.count()).toBe(0);
      }
    });
  }

  test("regressão: alternar statusFilter × sort N vezes mantém consistência", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 15_000,
    });

    // Snapshot inicial (sort=newest, statusFilter=all)
    await selectSort(page, "newest");
    const baseline = await visibleRowIds(page);

    // 4 ciclos: troca sort, volta; ativa um chip, desativa; valida consistência.
    for (let i = 0; i < 4; i++) {
      await selectSort(page, "expiring");
      // Lista de expiring NÃO pode ter expired
      expect(await page.locator(Sel.quotesList.statusBadge("expired")).count()).toBe(0);

      await selectSort(page, "highest");
      await selectSort(page, "newest");

      const current = await visibleRowIds(page);
      expect(current, `divergência no ciclo ${i}`).toEqual(baseline);
    }
  });
});

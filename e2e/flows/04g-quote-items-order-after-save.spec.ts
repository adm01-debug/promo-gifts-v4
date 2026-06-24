/**
 * E2E — Ordem dos itens permanece fixa após Salvar + Reload.
 *
 * Garante que, após persistir o orçamento e recarregar a página, a ordem
 * renderizada (`data-quote-item-id`) continua espelhando exatamente a fonte
 * de dados — sem reordenação implícita.
 */
import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { TID, TID_PREFIX } from "./fixtures/selectors";

test.describe("Itens do orçamento — ordem estável após salvar", () => {
  test.beforeEach(() => requireAuth());

  test("ordem se mantém após Salvar e Reload", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    const list = page.locator(TID("quote-items-list"));
    if (!(await list.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Sem itens no orçamento neste ambiente.");
      return;
    }

    const rows = page.locator(TID_PREFIX("quote-item-"));
    const count = await rows.count();
    if (count < 2) {
      test.skip(true, "Necessário ≥ 2 itens para validar persistência da ordem.");
      return;
    }

    const readOrder = () =>
      rows.evaluateAll((els) =>
        els.map((e) => (e as HTMLElement).dataset.quoteItemId ?? null),
      );

    const before = await readOrder();

    // Salvar — botão de salvar do builder (testid padrão).
    const saveBtn = page.getByRole("button", { name: /salvar/i }).first();
    if (!(await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, "Botão Salvar indisponível neste ambiente.");
      return;
    }
    await saveBtn.click();

    // Aguarda persistência (URL pode mudar de /novo para /:id) e recarrega.
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.reload();
    await expect(list).toBeVisible();

    const after = await readOrder();
    expect(after).toEqual(before);
  });
});

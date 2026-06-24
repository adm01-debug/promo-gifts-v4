/**
 * E2E — Itens do orçamento: sem reordenação por teclado e ordem fixa após refresh.
 *
 * Garante que:
 *  - Nenhuma combinação de teclas (Setas / Enter / Espaço) com foco em um item
 *    inicia ou afeta reordenação.
 *  - Após `page.reload()`, a ordem dos `data-quote-item-id` permanece a mesma
 *    (espelho estrito da fonte de dados).
 */
import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { TID, TID_PREFIX } from "./fixtures/selectors";

test.describe("Itens do orçamento — sem reordenação por teclado", () => {
  test.beforeEach(() => requireAuth());

  test("teclado não reordena e refresh mantém a ordem", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    const list = page.locator(TID("quote-items-list"));
    if (!(await list.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Sem itens no orçamento neste ambiente.");
      return;
    }

    const rows = page.locator(TID_PREFIX("quote-item-"));
    const count = await rows.count();
    if (count < 2) {
      test.skip(true, "Necessário ≥ 2 itens para validar reordenação.");
      return;
    }

    const readOrder = () =>
      rows.evaluateAll((els) =>
        els.map((e) => (e as HTMLElement).dataset.quoteItemId ?? null),
      );

    const before = await readOrder();

    // Foco no primeiro item e tenta combos comuns de reordenação a11y do dnd-kit.
    await rows.nth(0).focus();
    for (const key of [
      "Enter",
      "Space",
      "ArrowDown",
      "ArrowDown",
      "Enter",
      "ArrowUp",
      "Space",
    ]) {
      await page.keyboard.press(key);
    }

    expect(await readOrder()).toEqual(before);

    // Refresh — ordem deve permanecer espelhando a fonte de dados.
    await page.reload();
    await expect(list).toBeVisible();
    expect(await readOrder()).toEqual(before);
  });
});

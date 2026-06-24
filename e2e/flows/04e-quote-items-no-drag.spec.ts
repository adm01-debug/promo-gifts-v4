/**
 * E2E — Itens do orçamento NÃO podem ser reordenados por drag.
 *
 * - Garante que nenhum handle de arrasto está visível no card.
 * - Tenta arrastar o primeiro item para a posição do segundo via mouse
 *   (down → move → up) e confirma que a ordem (`data-quote-item-id`)
 *   permanece a mesma — refletindo estritamente a fonte de dados.
 *
 * Se a lista não estiver populada no ambiente de teste, o spec é skipado.
 */
import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { TID, TID_PREFIX } from "./fixtures/selectors";

test.describe("Itens do orçamento — sem reordenação por drag", () => {
  test.beforeEach(() => requireAuth());

  test("não há handle de arrasto e a ordem é fixa", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    const list = page.locator(TID("quote-items-list"));
    if (!(await list.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Sem itens no orçamento neste ambiente.");
      return;
    }

    // 1) Sem handle de arrasto em lugar nenhum do card.
    await expect(page.getByLabel(/arrastar/i)).toHaveCount(0);
    await expect(page.locator("svg.lucide-grip-vertical")).toHaveCount(0);

    const rows = page.locator(TID_PREFIX("quote-item-"));
    const count = await rows.count();
    if (count < 2) {
      test.skip(true, "Necessário ≥ 2 itens para validar reordenação.");
      return;
    }

    const orderBefore = await rows.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.quoteItemId ?? null),
    );

    // 2) Tenta arrastar o primeiro até o segundo — não deve mudar nada.
    const source = rows.nth(0);
    const target = rows.nth(1);
    const sBox = await source.boundingBox();
    const tBox = await target.boundingBox();
    if (sBox && tBox) {
      await page.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { steps: 10 });
      await page.mouse.up();
    }

    const orderAfter = await rows.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.quoteItemId ?? null),
    );
    expect(orderAfter).toEqual(orderBefore);
  });
});

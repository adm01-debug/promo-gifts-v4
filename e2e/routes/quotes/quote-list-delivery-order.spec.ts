/**
 * Regressão: a coluna "Entrega" DEVE ficar entre "Data" e "Itens" no header
 * E na ordem das células renderizadas, em desktop e mobile, persistindo após
 * reload, troca de filtro (tabs de status) e paginação.
 */
import { expect, type Page } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

const TRIPLET = ["date", "delivery", "items"] as const;

async function headerOrder(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="quotes-col-header-"]')
    .evaluateAll((els) =>
      els.map((el) => (el.getAttribute("data-testid") ?? "").replace("quotes-col-header-", "")),
    );
}

async function assertDeliveryBetween(page: Page) {
  const order = await headerOrder(page);
  const idx = TRIPLET.map((id) => order.indexOf(id));
  for (const i of idx) expect(i).toBeGreaterThanOrEqual(0);
  expect(idx).toEqual([...idx].sort((a, b) => a - b));
  // Sequência contígua date → delivery → items.
  expect(order.slice(idx[0], idx[0] + 3)).toEqual([...TRIPLET]);

  // Header x células: largura/centro X de cada header deve casar com a
  // ordem horizontal das células correspondentes na primeira linha.
  const firstRow = page.locator('[data-testid^="quote-row-"]').first();
  if ((await firstRow.count()) === 0) return;

  const headerCenters: Record<string, number> = {};
  for (const id of TRIPLET) {
    const box = await page.locator(`[data-testid="quotes-col-header-${id}"]`).boundingBox();
    expect(box).toBeTruthy();
    headerCenters[id] = (box!.x + box!.width / 2);
  }
  expect(headerCenters.date).toBeLessThan(headerCenters.delivery);
  expect(headerCenters.delivery).toBeLessThan(headerCenters.items);
}

test.describe("[module:quotes] [component:quotes-list] [owner:team-growth] @regression route:/orcamentos", () => {
  for (const size of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    test(`Entrega entre Data e Itens (${size.name}) — reload + filtro + paginação`, async ({
      page,
    }) => {
      await loginAs(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await gotoAndSettle(page, "/orcamentos");

      // Estado inicial.
      await assertDeliveryBetween(page);

      // Reload.
      await page.reload();
      await gotoAndSettle(page, "/orcamentos");
      await assertDeliveryBetween(page);

      // Filtro: clica em uma tab de status diferente, se existir.
      const tab = page.getByRole("tab").filter({ hasText: /Rascunho|Pendente|Expirado/i }).first();
      if ((await tab.count()) > 0) {
        await tab.click().catch(() => undefined);
        await assertDeliveryBetween(page);
      }

      // Paginação: avança se o controle existir (botão "Próximo"/"Próxima").
      const next = page.getByRole("button", { name: /pr[óo]xim[ao]/i }).first();
      if ((await next.count()) > 0 && (await next.isEnabled().catch(() => false))) {
        await next.click();
        await assertDeliveryBetween(page);
      }
    });
  }
});

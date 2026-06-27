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

async function cellOrderInFirstRow(page: Page): Promise<string[]> {
  const row = page.locator('[data-testid^="quote-row-"]').first();
  if ((await row.count()) === 0) return [];
  return row
    .locator('[data-testid^="quotes-col-cell-"]')
    .evaluateAll((els) =>
      els.map((el) => (el.getAttribute("data-testid") ?? "").replace("quotes-col-cell-", "")),
    );
}

async function assertDeliveryBetween(page: Page) {
  // (1) Header: date → delivery → items contíguos.
  const header = await headerOrder(page);
  const hIdx = TRIPLET.map((id) => header.indexOf(id));
  for (const i of hIdx) expect(i).toBeGreaterThanOrEqual(0);
  expect(header.slice(hIdx[0], hIdx[0] + 3)).toEqual([...TRIPLET]);

  // (2) Células da primeira linha: mesma ordem relativa por testid (sem depender de X).
  const cells = await cellOrderInFirstRow(page);
  if (cells.length === 0) return;
  const cIdx = TRIPLET.map((id) => cells.indexOf(id));
  for (const i of cIdx) expect(i).toBeGreaterThanOrEqual(0);
  expect(cells.slice(cIdx[0], cIdx[0] + 3)).toEqual([...TRIPLET]);

  // (3) Paridade: ordem do header == ordem das células.
  expect(cells).toEqual(header);
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

  test("a11y: headers expõem role=columnheader, aria-label e data-col-id consistentes", async ({
    page,
  }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/orcamentos");
    const meta = await page
      .locator('[data-testid^="quotes-col-header-"]')
      .evaluateAll((els) =>
        els.map((el) => ({
          testid: el.getAttribute("data-testid"),
          colId: el.getAttribute("data-col-id"),
          role: el.getAttribute("role"),
          aria: el.getAttribute("aria-label"),
          label: el.textContent?.trim() ?? "",
        })),
      );
    expect(meta.length).toBeGreaterThan(0);
    for (const h of meta) {
      expect(h.testid).toBe(`quotes-col-header-${h.colId}`);
      expect(h.role).toBe("columnheader");
      expect(h.aria).toBe(`Coluna ${h.label}`);
      expect(h.colId).toMatch(/^[a-z_]+$/);
    }
    // Paridade célula x header: mesmo conjunto de col-ids na primeira linha.
    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    if ((await firstRow.count()) === 0) return;
    const cellIds = await firstRow
      .locator('[data-testid^="quotes-col-cell-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-col-id")));
    expect(cellIds).toEqual(meta.map((h) => h.colId));
  });

  test("ordem preservada em múltiplas larguras + scroll horizontal", async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/orcamentos");
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 800 },
      { width: 1024, height: 720 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await assertDeliveryBetween(page);
    }
    // Scroll horizontal no container — não pode reordenar.
    await page.setViewportSize({ width: 600, height: 800 });
    const scroller = page.locator(".overflow-x-auto").first();
    if ((await scroller.count()) > 0) {
      await scroller.evaluate((el) => el.scrollTo({ left: 9999 }));
      await assertDeliveryBetween(page);
    }
  });
});

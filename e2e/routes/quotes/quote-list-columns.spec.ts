/**
 * Garante que a lista de Orçamentos tem colunas FIXAS na ordem do design
 * (Empresa, Contato, Data, Itens, Valor, Entrega, Status, Nº Orçamento)
 * e que o header NÃO expõe controles de drag-and-drop.
 */
import { expect } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

const EXPECTED_ORDER = [
  "client",
  "contact",
  "date",
  "delivery",
  "items",
  "value",
  "status",
  "expiration",
  "quote_number",
] as const;

test.describe("[module:quotes] [component:quotes-list] [owner:team-growth] @regression route:/orcamentos", () => {
  test("colunas fixas na ordem canônica e sem controles de drag @smoke", async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/orcamentos");

    // Cada coluna esperada existe.
    for (const id of EXPECTED_ORDER) {
      await expect(page.locator(`[data-testid="quotes-col-header-${id}"]`)).toBeVisible();
    }

    // Ordem visual é a canônica (sem DnD = ordem inalterável).
    const ids = await page
      .locator('[data-testid^="quotes-col-header-"]')
      .evaluateAll((els) =>
        els.map((el) =>
          (el.getAttribute("data-testid") ?? "").replace("quotes-col-header-", ""),
        ),
      );
    expect(ids).toEqual([...EXPECTED_ORDER]);

    // Nenhum header deve ter cursor-grab nem ícone de grip (DnD removido).
    const headers = page.locator('[data-testid^="quotes-col-header-"]');
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const cls = (await headers.nth(i).getAttribute("class")) ?? "";
      expect(cls).not.toMatch(/cursor-grab/);
      await expect(headers.nth(i).locator("svg.lucide-grip-vertical")).toHaveCount(0);
    }
  });
});

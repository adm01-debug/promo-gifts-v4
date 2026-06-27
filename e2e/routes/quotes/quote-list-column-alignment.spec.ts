/**
 * Garante que as colunas "Valor" e "Nº Orçamento" usam alinhamento à esquerda
 * (padrão das outras colunas como "Data"/"Contato") tanto no header quanto
 * nas células, em desktop e mobile, e que isso persiste após reload.
 */
import { expect } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

const LEFT_ALIGNED = ["date", "value", "quote_number"] as const;

async function assertLeftAligned(
  page: import("@playwright/test").Page,
  testid: string,
) {
  const el = page.locator(`[data-testid="${testid}"]`).first();
  await expect(el).toBeVisible();
  const cls = (await el.getAttribute("class")) ?? "";
  expect(cls).not.toMatch(/\btext-right\b/);
  expect(cls).not.toMatch(/\btext-center\b/);
  const textAlign = await el.evaluate((node) => getComputedStyle(node).textAlign);
  // 'start' e 'left' são equivalentes em LTR (default do app).
  expect(["left", "start"]).toContain(textAlign);
}

test.describe("[module:quotes] [component:quotes-list] [owner:team-growth] @regression route:/orcamentos", () => {
  for (const size of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    test(`Valor e Nº Orçamento alinhados à esquerda (${size.name}) e persistem após reload`, async ({
      page,
    }) => {
      await loginAs(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await gotoAndSettle(page, "/orcamentos");

      // Headers — mesmo padrão de "date".
      for (const id of LEFT_ALIGNED) {
        await assertLeftAligned(page, `quotes-col-header-${id}`);
      }

      // Células: pega a primeira linha; se não houver, encerra (sem dado de teste).
      const firstRow = page.locator('[data-testid^="quote-row-"]').first();
      if ((await firstRow.count()) === 0) {
        test.info().annotations.push({ type: "skip-rows", description: "Sem linhas para validar" });
      } else {
        for (const id of ["value", "quote_number"] as const) {
          const headerBox = await page
            .locator(`[data-testid="quotes-col-header-${id}"]`)
            .boundingBox();
          // A célula correspondente na primeira linha é o n-ésimo filho do grid;
          // validamos via alinhamento computado do container da célula.
          const cellContainer = firstRow.locator("> div").nth(
            // pula a coluna de seleção se existir
            await firstRow.locator('[aria-label="Selecionar orçamento"]').count() > 0
              ? indexOf(id) + 1
              : indexOf(id),
          );
          const ta = await cellContainer.evaluate((n) => getComputedStyle(n).textAlign);
          expect(["left", "start"]).toContain(ta);
          expect(headerBox).toBeTruthy();
        }
      }

      // Reload e revalida headers.
      await page.reload();
      await gotoAndSettle(page, "/orcamentos");
      for (const id of LEFT_ALIGNED) {
        await assertLeftAligned(page, `quotes-col-header-${id}`);
      }
    });
  }
});

// Ordem canônica das colunas em ALL_COLUMNS (sem a de seleção):
// client, contact, date, items, value, delivery, status, expiration, quote_number
function indexOf(id: "value" | "quote_number"): number {
  const ORDER = [
    "client",
    "contact",
    "date",
    "items",
    "value",
    "delivery",
    "status",
    "expiration",
    "quote_number",
  ] as const;
  return ORDER.indexOf(id);
}

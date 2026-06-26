/**
 * Em telas menores a tabela:
 *  - tem container com overflow-x-auto (scroll horizontal disponível)
 *  - mantém min-w-[1100px] no wrapper interno (não deforma colunas)
 *  - colunas truncam (sem wrap) e o alinhamento header↔célula se preserva
 *    durante o scroll horizontal.
 */
import { expect } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

test.describe("[module:quotes] [component:quotes-list] [owner:team-growth] @regression route:/orcamentos", () => {
  test("scroll horizontal em telas menores preserva truncamento e alinhamento", async ({ page }) => {
    await loginAs(page);
    await page.setViewportSize({ width: 900, height: 720 });
    await gotoAndSettle(page, "/orcamentos");

    const scroller = page.locator(".overflow-x-auto").first();
    await expect(scroller).toBeVisible();

    // Wrapper interno tem min-width maior que o viewport → habilita scroll.
    const inner = scroller.locator(":scope > .min-w-\\[1100px\\]");
    await expect(inner).toBeVisible();

    const { scrollW, clientW } = await scroller.evaluate((el) => ({
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    }));
    expect(scrollW).toBeGreaterThan(clientW);

    // Truncamento: cliente e status usam `truncate` (white-space: nowrap).
    const clientCell = page.locator('[data-testid="quote-client-cell"]').first();
    if ((await clientCell.count()) === 0) {
      test.skip(true, "Sem orçamentos para validar truncamento.");
    }
    const clientSpan = clientCell.locator("span").first();
    await expect(clientSpan).toHaveClass(/truncate/);
    const whiteSpace = await clientSpan.evaluate((el) => getComputedStyle(el).whiteSpace);
    expect(whiteSpace).toBe("nowrap");

    // Captura X do header e da célula da coluna `client` antes/depois do scroll.
    const clientHeader = page.locator('[data-testid="quotes-col-header-client"]').first();
    const beforeHeader = await clientHeader.boundingBox();
    const beforeCell = await clientCell.boundingBox();
    expect(beforeHeader && beforeCell).toBeTruthy();
    if (beforeHeader && beforeCell) {
      expect(Math.abs(beforeHeader.x - beforeCell.x)).toBeLessThanOrEqual(2);
    }

    // Rola horizontalmente o container interno.
    await scroller.evaluate((el) => {
      el.scrollLeft = 200;
    });
    await page.waitForFunction(
      () => {
        const el = document.querySelector(".overflow-x-auto") as HTMLElement | null;
        return !!el && el.scrollLeft >= 150;
      },
      { timeout: 2000 },
    );

    // Header e célula continuam alinhados (ambos rolam juntos).
    const afterHeader = await clientHeader.boundingBox();
    const afterCell = await clientCell.boundingBox();
    expect(afterHeader && afterCell).toBeTruthy();
    if (afterHeader && afterCell) {
      expect(Math.abs(afterHeader.x - afterCell.x)).toBeLessThanOrEqual(2);
    }
  });
});

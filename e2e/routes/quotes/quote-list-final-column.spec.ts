/**
 * Regressão pós-remoção das QuickActions inline:
 *  - Coluna final do grid (ações) mantém 56px no header e nas linhas.
 *  - Truncamento de Empresa/Status segue funcionando no responsivo.
 *  - Botão "⋮" continua acessível via data-testid estável.
 */
import { expect } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

test.describe("[module:quotes] [component:quotes-list] [owner:team-growth] @regression route:/orcamentos", () => {
  test("coluna final = 56px e truncamento preservados após remoção das QuickActions", async ({ page }) => {
    await loginAs(page);

    for (const size of [
      { width: 1440, height: 900 },
      { width: 1024, height: 720 },
      { width: 900, height: 720 },
    ]) {
      await page.setViewportSize(size);
      await gotoAndSettle(page, "/orcamentos");

      const inner = page.locator(".overflow-x-auto > .min-w-\\[1100px\\]").first();
      await expect(inner).toBeVisible();

      // Grid columns: última coluna deve ser exatamente 56px.
      const lastCol = await inner.evaluate((el) => {
        // Acha o primeiro descendente com gridTemplateColumns definido.
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
        let n: Node | null = walker.currentNode;
        while (n) {
          const cs = getComputedStyle(n as Element);
          if (cs.display === "grid" && cs.gridTemplateColumns && cs.gridTemplateColumns !== "none") {
            const parts = cs.gridTemplateColumns.split(" ");
            return parts[parts.length - 1];
          }
          n = walker.nextNode();
        }
        return null;
      });
      expect(lastCol).toBe("56px");

      // Botão ⋮ com data-testid estável.
      const more = page.locator('[data-testid^="quote-row-more-"]').first();
      if ((await more.count()) === 0) continue;
      await expect(more).toBeVisible();

      // Truncamento: Empresa e Status mantém `truncate`.
      const clientText = page.locator('[data-testid="quote-client-cell"] span').first();
      await expect(clientText).toHaveClass(/truncate/);
      const statusBadge = page.locator('[data-testid^="quote-status-badge-"]').first();
      await expect(statusBadge).toHaveClass(/truncate/);
    }
  });
});

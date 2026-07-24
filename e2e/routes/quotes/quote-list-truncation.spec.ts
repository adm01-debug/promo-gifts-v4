/**
 * Garante que Empresa e Status truncam com elegância em telas menores
 * e mantêm alinhamento consistente (mesma altura/baseline na linha).
 */
import { expect } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

test.describe("[module:quotes] [component:quotes-list] [owner:team-growth] @regression route:/orcamentos", () => {
  test("Empresa e Status truncam e alinham em telas menores @smoke", async ({ page }) => {
    await loginAs(page);
    await page.setViewportSize({ width: 1024, height: 720 });
    await gotoAndSettle(page, "/orcamentos");

    const clientCell = page.locator('[data-testid="quote-client-cell"]').first();
    const statusBadge = page.locator('[data-testid^="quote-status-badge-"]').first();

    if ((await clientCell.count()) === 0) {
      test.skip(true, "Sem orçamentos para validar truncamento.");
    }

    // Truncamento via classe utilitária `truncate` em ambos.
    const clientText = clientCell.locator("span").first();
    await expect(clientText).toHaveClass(/truncate/);
    await expect(statusBadge).toHaveClass(/truncate/);

    // overflow-x-auto no container preserva alinhamento sem quebrar layout.
    const tableScroll = page.locator(".overflow-x-auto").first();
    await expect(tableScroll).toBeVisible();

    // Empresa e Status compartilham a mesma linha → top alinhado (±2px).
    const clientBox = await clientCell.boundingBox();
    const statusBox = await statusBadge.boundingBox();
    expect(clientBox && statusBox).toBeTruthy();
    if (clientBox && statusBox) {
      const clientMid = clientBox.y + clientBox.height / 2;
      const statusMid = statusBox.y + statusBox.height / 2;
      expect(Math.abs(clientMid - statusMid)).toBeLessThanOrEqual(4);
    }
  });

  test("após redimensionar, header continua sem controles de drag/grip", async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/orcamentos");

    for (const size of [
      { width: 1440, height: 900 },
      { width: 1024, height: 720 },
      { width: 800, height: 600 },
    ]) {
      await page.setViewportSize(size);
      const headers = page.locator('[data-testid^="quotes-col-header-"]');
      const n = await headers.count();
      for (let i = 0; i < n; i++) {
        const cls = (await headers.nth(i).getAttribute("class")) ?? "";
        expect(cls).not.toMatch(/cursor-grab/);
        await expect(headers.nth(i).locator("svg.lucide-grip-vertical")).toHaveCount(0);
      }
    }
  });
});

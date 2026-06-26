/**
 * E2E — Badges de status na tabela de /orcamentos.
 *
 * Cobre:
 *  - Seed determinístico de 1 quote por estado visual (draft, unsynced, synced, expired).
 *  - Renderização do badge com texto e classes de cor corretas.
 *  - Tooltip explicando o significado (incl. combinação synced × DAR).
 *  - Comportamento colapsável da legenda.
 *  - Visual regression em modo claro e escuro da legenda completa.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";

interface Expect {
  key: "draft" | "unsynced" | "synced" | "expired";
  label: RegExp;
  classNeedle: string;
}

const EXPECTED: Expect[] = [
  { key: "draft", label: /Rascunho/, classNeedle: "purple" },
  { key: "unsynced", label: /Criado \(Não Sincronizado\)/, classNeedle: "yellow" },
  { key: "synced", label: /Criado\/Sincronizado/, classNeedle: "primary" },
  { key: "expired", label: /Expirado/, classNeedle: "muted" },
];

test.describe("Quotes — Status badges", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth();
    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    if (seed.skipped) {
      test.skip(true, `seed pulado: ${seed.skipped}`);
    }
    // Recarrega para garantir hidratação após seed.
    await gotoAndSettle(page, "/orcamentos");
  });

  for (const exp of EXPECTED) {
    test(`badge "${exp.key}" renderiza com cor e tooltip correta`, async ({ page }) => {
      const badge = page
        .locator(`[data-testid="quote-status-badge-${exp.key}"]`)
        .first();
      await expect(badge).toBeVisible({ timeout: 10_000 });
      await expect(badge).toHaveText(exp.label);

      const className = (await badge.getAttribute("class")) ?? "";
      expect(className).toContain(exp.classNeedle);

      await badge.hover();
      const tooltip = page
        .locator(`[data-testid="quote-status-badge-tooltip-${exp.key}"]`)
        .first();
      await expect(tooltip).toBeVisible({ timeout: 3_000 });
      const tip = (await tooltip.textContent())?.trim() ?? "";
      expect(tip.length).toBeGreaterThan(10);
      if (exp.key === "synced" || exp.key === "unsynced") {
        expect(tip).toMatch(/synced_to_bitrix/);
      }
    });
  }

  test("legenda colapsável abre e lista os 13 estados", async ({ page }) => {
    const summary = page.getByTestId("quote-badge-legend-summary");
    await expect(summary).toBeVisible();
    await summary.click();
    const list = page.getByTestId("quote-badge-legend-list");
    await expect(list).toBeVisible();
    const items = list.locator('[data-testid^="quote-badge-legend-item-"]');
    await expect(items).toHaveCount(13);
  });

  test("visual regression — legenda em modo claro", async ({ page }) => {
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    const summary = page.getByTestId("quote-badge-legend-summary");
    await summary.click();
    const legend = page.getByTestId("quote-badge-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toHaveScreenshot("quote-badge-legend-light.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("visual regression — legenda em modo escuro", async ({ page }) => {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    const summary = page.getByTestId("quote-badge-legend-summary");
    await summary.click();
    const legend = page.getByTestId("quote-badge-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toHaveScreenshot("quote-badge-legend-dark.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});

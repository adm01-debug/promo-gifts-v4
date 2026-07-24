/**
 * Verifica o texto canônico do tooltip do chip/badge "awaiting" (Pendente Aprovação)
 * em mobile, tablet e desktop. A copy vem do SSOT `QUOTE_ROW_BADGE_STYLES.awaiting.description`.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";
import { QUOTE_ROW_BADGE_STYLES } from "../../src/components/quotes/QuotesStatusChips";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const EXPECTED = QUOTE_ROW_BADGE_STYLES.awaiting.description;

test.describe("Tooltip 'awaiting' — copy canônica por viewport", () => {
  test.beforeEach(() => requireAuth());

  for (const vp of VIEWPORTS) {
    test(`exibe copy correta em ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, "/orcamentos");
      const seed = await seedQuotesForStatusChips(page);
      expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();
      await gotoAndSettle(page, "/orcamentos");
      await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
        timeout: 10_000,
      });

      // Sanity: garante que a copy nova está em vigor (regressão da string antiga).
      expect(EXPECTED).toBe(
        "Orçamento com desconto acima do limite padrão da empresa, enviado para autorização do Gestor Comercial.",
      );

      const chip = page.locator(Sel.quotesList.chip("pending_approval"));
      if ((await chip.count()) > 0) {
        await chip.scrollIntoViewIfNeeded();
        await chip.hover();
        const tip = page.locator(Sel.quotesList.chipTooltip("pending_approval")).first();
        await expect(tip).toBeVisible({ timeout: 2_000 });
        await expect(tip).toHaveText(EXPECTED);
        await page.mouse.move(0, 0);
      }

      const badge = page.locator(Sel.quotesList.statusBadge("awaiting")).first();
      if ((await badge.count()) > 0) {
        await badge.scrollIntoViewIfNeeded();
        await badge.hover();
        const tip = page.locator(Sel.quotesList.statusBadgeTooltip("awaiting")).first();
        await expect(tip).toBeVisible({ timeout: 2_000 });
        await expect(tip).toHaveText(EXPECTED);
      }
    });
  }
});

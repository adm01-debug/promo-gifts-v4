/**
 * Fluxo: tooltips Radix (didáticos para vendedor) em /orcamentos.
 * Verifica que ao passar o mouse OU focar (teclado) em cada chip de status,
 * o `TooltipContent` aparece com o texto canônico de `QUOTE_ROW_BADGE_STYLES`.
 *
 * Também verifica o tooltip do badge de status dentro da linha da tabela.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";
import { QUOTE_ROW_BADGE_STYLES } from "../../src/components/quotes/QuotesStatusChips";

// Mapa: chave do chip → chave de QUOTE_ROW_BADGE_STYLES (espelha CHIP_TOOLTIPS).
const CHIP_TO_BADGE: Record<string, keyof typeof QUOTE_ROW_BADGE_STYLES | "all"> = {
  all: "all",
  draft: "draft",
  unsynced: "unsynced",
  created_synced: "synced",
  pending_approval: "awaiting",
  expired: "expired",
};

const ALL_COPY = "Mostra todos os seus orçamentos, em qualquer fase.";

test.describe("Fluxo: tooltips didáticos de status de orçamentos", () => {
  test.beforeEach(() => requireAuth());

  test("hover e focus em cada chip exibem o tooltip Radix com o texto canônico", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();
    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });

    for (const [chipKey, badgeKey] of Object.entries(CHIP_TO_BADGE)) {
      const chip = page.locator(Sel.quotesList.chip(chipKey));
      if ((await chip.count()) === 0) continue; // chip oculto quando count=0

      const expected =
        badgeKey === "all" ? ALL_COPY : QUOTE_ROW_BADGE_STYLES[badgeKey].description;

      // Hover dispara o tooltip Radix.
      await chip.hover();
      const tooltip = page.locator(Sel.quotesList.chipTooltip(chipKey)).first();
      await expect(tooltip, `tooltip do chip ${chipKey}`).toBeVisible({ timeout: 2_000 });
      await expect(tooltip).toHaveText(expected);

      // Move o mouse para fora para fechar antes do próximo.
      await page.mouse.move(0, 0);
      await expect(tooltip).toBeHidden({ timeout: 2_000 });

      // Foco por teclado também precisa abrir o tooltip (a11y).
      await chip.focus();
      await expect(tooltip).toBeVisible({ timeout: 2_000 });
      await page.keyboard.press("Escape");
    }
  });

  test("badge de status dentro da linha exibe tooltip ao hover", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();
    await gotoAndSettle(page, "/orcamentos");

    // Pega o primeiro badge visível de qualquer status conhecido.
    const knownKeys: Array<keyof typeof QUOTE_ROW_BADGE_STYLES> = [
      "draft",
      "unsynced",
      "synced",
      "awaiting",
      "expired",
    ];
    for (const key of knownKeys) {
      const badge = page.locator(Sel.quotesList.statusBadge(key)).first();
      if ((await badge.count()) === 0) continue;
      await badge.scrollIntoViewIfNeeded();
      await badge.hover();
      const tip = page.locator(Sel.quotesList.statusBadgeTooltip(key)).first();
      await expect(tip).toBeVisible({ timeout: 2_000 });
      await expect(tip).toHaveText(QUOTE_ROW_BADGE_STYLES[key].description);
      return;
    }
    throw new Error("nenhum badge de status conhecido foi encontrado na lista");
  });
});

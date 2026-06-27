/**
 * A11y dos tooltips de status — itera TODOS os 14 badges canônicos do SSOT
 * `QUOTE_ROW_BADGE_STYLES` e valida, por foco via teclado:
 *   - `aria-describedby` é injetado pelo Radix quando o tooltip abre
 *   - o elemento referenciado contém EXATAMENTE a copy do SSOT
 *
 * Itera também os chips do topo (subset reachable via seed).
 *
 * Limite documentado: o badge `cancelled` não é alcançável via INSERT
 * direto (CHECK do BD bloqueia `quotes.status='cancelled'`). O spec
 * registra o motivo via `perTarget` em vez de falhar.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips, ALL_BADGE_KEYS } from "../helpers/quotes-status-seed";
import {
  QUOTE_ROW_BADGE_STYLES,
  CHIP_TOOLTIPS,
} from "../../src/components/quotes/QuotesStatusChips";

test.describe("A11y: tooltips de status (aria-describedby + teclado)", () => {
  test.beforeEach(() => requireAuth());

  test("badges: cada um dos 14 status expõe tooltip via foco com a copy correta", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();
    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });

    const unreachable = seed.perTarget.filter((t) => !t.seeded).map((t) => t.badge_key);
    // Sanity: só 'cancelled' pode estar fora (CHECK do BD).
    expect(unreachable.sort()).toEqual(["cancelled"]);

    const reachable = ALL_BADGE_KEYS.filter((k) => k !== "cancelled");
    expect(reachable).toHaveLength(13);

    for (const key of reachable) {
      const badge = page.locator(Sel.quotesList.statusBadge(key)).first();
      await expect(badge, `badge ${key} deve estar na lista`).toBeVisible({
        timeout: 10_000,
      });
      await badge.scrollIntoViewIfNeeded();

      // Foco programático no trigger (igual a Tab para um usuário de teclado).
      await badge.focus();

      const tooltipId = await badge.getAttribute("aria-describedby");
      expect(tooltipId, `aria-describedby ausente em badge ${key}`).toBeTruthy();

      const tip = page.locator(Sel.quotesList.statusBadgeTooltip(key)).first();
      await expect(tip).toBeVisible({ timeout: 2_000 });
      // aria-describedby precisa apontar para o tooltip renderizado.
      await expect(tip).toHaveAttribute("id", tooltipId!);
      await expect(tip).toHaveText(QUOTE_ROW_BADGE_STYLES[key].description);

      // Fecha para o próximo ciclo (Esc é o atalho oficial do Radix).
      await page.keyboard.press("Escape");
    }
  });

  test("chips: foco via teclado abre tooltip com aria-describedby correto", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped).toBeNull();
    await gotoAndSettle(page, "/orcamentos");

    for (const chipKey of Object.keys(CHIP_TOOLTIPS)) {
      const chip = page.locator(Sel.quotesList.chip(chipKey));
      if ((await chip.count()) === 0) continue;

      await chip.focus();
      const tooltipId = await chip.getAttribute("aria-describedby");
      expect(tooltipId, `aria-describedby ausente em chip ${chipKey}`).toBeTruthy();

      const tip = page.locator(Sel.quotesList.chipTooltip(chipKey)).first();
      await expect(tip).toBeVisible({ timeout: 2_000 });
      await expect(tip).toHaveAttribute("id", tooltipId!);
      await expect(tip).toHaveText(CHIP_TOOLTIPS[chipKey]);
      await page.keyboard.press("Escape");
    }
  });
});

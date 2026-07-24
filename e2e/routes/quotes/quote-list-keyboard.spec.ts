/**
 * Navegação por teclado na lista de Orçamentos:
 *  - Foco visível (focus-visible:ring) aparece no botão "⋮" (MoreVertical).
 *  - Botão possui aria-label descritivo.
 */
import { expect } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

test.describe("[module:quotes] [component:quotes-list] [owner:team-growth] @regression route:/orcamentos", () => {
  test("MoreVertical com aria-label e focus-visible visível", async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/orcamentos");

    const mais = page.locator('button[aria-label^="Mais opções para o orçamento"]').first();
    if ((await mais.count()) === 0) {
      test.skip(true, "Sem orçamentos para validar navegação por teclado.");
    }

    await expect(mais).toHaveAttribute("aria-label", /Mais opções/);

    await mais.focus();
    await expect(mais).toBeFocused();
    const cls = (await mais.getAttribute("class")) ?? "";
    expect(cls).toMatch(/focus-visible:ring-2/);
  });
});

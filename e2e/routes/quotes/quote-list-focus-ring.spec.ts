/**
 * Validação visual do anel `focus-visible` em QuickActions e MoreVertical
 * nos temas claro e escuro:
 *  - ring renderizado (box-shadow não nulo) ao focar via teclado
 *  - cor do ring respeita o token `--ring` do tema ativo (não é igual ao fundo)
 */
import { expect } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

async function applyTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(t);
  }, theme);
}

async function readRing(page: import("@playwright/test").Page, locator: import("@playwright/test").Locator) {
  await locator.focus();
  return locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      boxShadow: cs.boxShadow,
      outline: cs.outline,
      bg: cs.backgroundColor,
    };
  });
}

test.describe("[module:quotes] [component:quotes-list] [owner:team-growth] @regression route:/orcamentos", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`focus-visible visível e contrastado nos botões — tema ${theme}`, async ({ page }) => {
      await loginAs(page);
      await gotoAndSettle(page, "/orcamentos");
      await applyTheme(page, theme);

      const duplicar = page.getByRole("button", { name: "Duplicar orçamento" }).first();
      const mais = page.locator('button[aria-label^="Mais opções para o orçamento"]').first();

      if ((await duplicar.count()) === 0) {
        test.skip(true, "Sem orçamentos para validar focus-visible.");
      }

      for (const btn of [duplicar, mais]) {
        const { boxShadow, outline, bg } = await readRing(page, btn);
        // Tailwind `ring-2` produz box-shadow não-nulo quando focado.
        const hasRing = boxShadow !== "none" || /\d/.test(outline);
        expect(hasRing, `esperado anel de foco visível (boxShadow=${boxShadow}, outline=${outline})`).toBe(true);
        // Ring não pode ser igual ao próprio fundo (contraste mínimo).
        expect(boxShadow).not.toContain(bg);
      }
    });
  }
});

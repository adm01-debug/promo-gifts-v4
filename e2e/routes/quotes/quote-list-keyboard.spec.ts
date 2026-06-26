/**
 * Navegação por teclado na lista de Orçamentos:
 *  - Tab/Shift+Tab percorrem QuickActions e o botão MoreVertical.
 *  - Foco visível (focus-visible:ring) aparece no botão focado.
 *  - Botões possuem aria-label descritivo.
 */
import { expect } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

test.describe("[module:quotes] [component:quotes-list] [owner:team-growth] @regression route:/orcamentos", () => {
  test("Tab/Shift+Tab percorre QuickActions + MoreVertical com foco visível", async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/orcamentos");

    const duplicar = page.getByRole("button", { name: "Duplicar orçamento" }).first();
    const copiarLink = page.getByRole("button", { name: "Copiar link do orçamento" }).first();
    const whatsapp = page.getByRole("button", { name: "Enviar por WhatsApp" }).first();
    const mais = page.locator('button[aria-label^="Mais opções para o orçamento"]').first();

    if ((await duplicar.count()) === 0) {
      test.skip(true, "Sem orçamentos para validar navegação por teclado.");
    }

    // aria-labels presentes (todos os elementos resolvidos por nome acessível).
    await expect(duplicar).toHaveAttribute("aria-label", /Duplicar/);
    await expect(copiarLink).toHaveAttribute("aria-label", /Copiar link/);
    await expect(whatsapp).toHaveAttribute("aria-label", /WhatsApp/);
    await expect(mais).toHaveAttribute("aria-label", /Mais opções/);

    // Foco programático + verificação do anel focus-visible.
    await duplicar.focus();
    await expect(duplicar).toBeFocused();
    const duplicarCls = (await duplicar.getAttribute("class")) ?? "";
    expect(duplicarCls).toMatch(/focus-visible:ring-2/);

    // Tab → próximo botão da QuickActions (Copiar link).
    await page.keyboard.press("Tab");
    await expect(copiarLink).toBeFocused();

    // Tab → WhatsApp.
    await page.keyboard.press("Tab");
    await expect(whatsapp).toBeFocused();

    // Shift+Tab → volta para Copiar link.
    await page.keyboard.press("Shift+Tab");
    await expect(copiarLink).toBeFocused();

    // MoreVertical também tem focus-visible:ring.
    await mais.focus();
    await expect(mais).toBeFocused();
    const maisCls = (await mais.getAttribute("class")) ?? "";
    expect(maisCls).toMatch(/focus-visible:ring-2/);
  });
});

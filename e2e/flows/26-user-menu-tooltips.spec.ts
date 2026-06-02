/**
 * Fluxo: tooltips dos itens "Skins" e "Guia Rápido" do menu do usuário.
 *
 * Cobre:
 *  1. Abrir o menu, focar cada item via teclado e validar que o tooltip
 *     correspondente aparece com o texto esperado, posicionado à esquerda
 *     (`data-side="left"`) — não colide com o DropdownMenu (que abre à
 *     direita).
 *  2. Ao mover o foco/cursor para fora do item, o tooltip desaparece.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

const ITEMS = [
  {
    item: "user-menu-item-skins",
    tip: "user-menu-tooltip-skins",
    text: "Personalize a aparência da plataforma",
  },
  {
    item: "user-menu-item-guia-rapido",
    tip: "user-menu-tooltip-guia-rapido",
    text: "Reiniciar o tour guiado pelas funcionalidades do sistema",
  },
] as const;

test.describe("Fluxo: tooltips do menu do usuário", () => {
  test.beforeEach(() => requireAuth());

  for (const { item, tip, text } of ITEMS) {
    test(`tooltip de "${item}" abre, mostra texto correto e fica à esquerda`, async ({
      page,
    }) => {
      await gotoAndSettle(page, "/");
      await page.getByTestId("user-menu-trigger").click();

      const menuItem = page.getByTestId(item);
      await expect(menuItem).toBeVisible();
      await menuItem.hover();

      const tooltip = page.getByTestId(tip);
      await expect(tooltip).toBeVisible({ timeout: 4000 });
      await expect(tooltip).toContainText(text);
      await expect(tooltip).toHaveAttribute("data-side", "left");

      // Fecha ao tirar o cursor do item
      await page.mouse.move(0, 0);
      await expect(tooltip).toBeHidden({ timeout: 4000 });
    });
  }
});

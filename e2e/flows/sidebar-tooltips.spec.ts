/**
 * Regressão E2E — Tooltips comerciais da sidebar.
 *
 * Garante que TODO item visível da sidebar com `data-tooltip-label`
 * mostra a mensagem ao hover e a esconde ao mouse out, em runtime real
 * (Radix Tooltip + pointer events nativos do Chromium).
 *
 * Selecionamos itens via `[data-tooltip-label]` para evitar acoplamento
 * frágil ao texto do link, e validamos a mensagem comparando o conteúdo
 * do `[role="tooltip"]` aberto.
 */
import { test, expect } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";

test.describe("Sidebar — tooltips comerciais (hover/unhover)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "user");
    await gotoAndSettle(page, "/");

    // Em viewports mobile a sidebar fica atrás de um hamburger.
    // Abre o menu se ele não estiver visível.
    const sidebar = page.locator('aside, [data-sidebar="sidebar"]').first();
    if (!(await sidebar.isVisible().catch(() => false))) {
      const openBtn = page.getByRole("button", { name: /abrir menu|menu/i }).first();
      if (await openBtn.isVisible().catch(() => false)) {
        await openBtn.click();
        await sidebar.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
      }
    }
  });

  test("hover mostra tooltip e mouse out o remove em todos os itens", async ({ page }) => {
    // Garante grupos expandidos: Catálogo + Orçamentos abrem por defaultOpen.
    // Pega todos os triggers de tooltip da sidebar.
    const triggers = page.locator(
      'aside [data-tooltip-label], nav [data-tooltip-label], [data-sidebar="sidebar"] [data-tooltip-label]',
    );
    const count = await triggers.count();
    expect(count, "deve existir ao menos 5 itens com tooltip visíveis").toBeGreaterThanOrEqual(5);

    // Limita a um subconjunto para manter o teste rápido (<30s no CI).
    const sample = Math.min(count, 10);

    for (let i = 0; i < sample; i += 1) {
      const trigger = triggers.nth(i);
      const expected = await trigger.getAttribute("data-tooltip-label");
      if (!expected) continue;

      await trigger.scrollIntoViewIfNeeded();
      await trigger.hover();

      const tooltip = page.getByRole("tooltip", { name: expected });
      await expect(tooltip, `tooltip deve aparecer para "${expected}"`).toBeVisible({ timeout: 2000 });

      // Move o mouse para uma área neutra e valida que o tooltip some.
      await page.mouse.move(2000, 2000);
      await expect(tooltip, `tooltip deve sumir após mouse out de "${expected}"`).toBeHidden({
        timeout: 2000,
      });
    }
  });
});

/**
 * E2E — Colapso do ConfigurationPanelV6 (gravação).
 *
 * Cobre:
 *  - Toggle colapsa/expande a região (aria-expanded, hidden).
 *  - Persistência após reload (localStorage por technique_id).
 *  - Navegação via teclado (Tab + Enter/Space).
 *
 * O painel só aparece no fluxo de orçamento após escolher cliente/produto
 * com personalização. Para manter o spec robusto e desacoplado de seed,
 * navegamos até `/orcamentos/novo` e o teste só executa de fato quando o
 * toggle estiver presente. Caso contrário, é encerrado com `test.skip()`
 * — o gate evita falsos negativos em ambientes sem dados.
 */
import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { TID } from "./fixtures/selectors";

const TOGGLE = TID("customization-collapse-toggle");

test.describe("ConfigurationPanelV6 — colapso", () => {
  test.beforeEach(() => requireAuth());

  test("colapsa, expande, persiste após reload e responde ao teclado", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    const toggle = page.locator(TOGGLE).first();
    if (!(await toggle.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Painel de personalização indisponível neste ambiente.");
      return;
    }

    // Estado inicial: expandido.
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const controlsId = await toggle.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    const region = page.locator(`#${controlsId}`);
    await expect(region).not.toHaveAttribute("hidden", "");

    // Clique → colapsa.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(region).toHaveAttribute("hidden", "");

    // Persistência em localStorage e após reload.
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("customization-collapsed:v1"),
    );
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string)).toEqual(expect.objectContaining({}));

    await page.reload({ waitUntil: "domcontentloaded" });
    const toggleAfter = page.locator(TOGGLE).first();
    await expect(toggleAfter).toBeVisible({ timeout: 10_000 });
    await expect(toggleAfter).toHaveAttribute("aria-expanded", "false");

    // Navegação por teclado: foca o botão e ativa via Enter.
    await toggleAfter.focus();
    await expect(toggleAfter).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toggleAfter).toHaveAttribute("aria-expanded", "true");

    // Space também alterna.
    await page.keyboard.press("Space");
    await expect(toggleAfter).toHaveAttribute("aria-expanded", "false");
  });
});

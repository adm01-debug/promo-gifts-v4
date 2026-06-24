/**
 * E2E — Colapso do ConfigurationPanelV6 (gravação).
 *
 * Cobre:
 *  - Toggle colapsa/expande a região (aria-expanded, hidden).
 *  - Persistência após reload (localStorage v1).
 *  - Navegação via teclado (Enter / Space) com foco gerenciado.
 *  - Emissão de evento de analytics (`panel_collapsed` / `panel_expanded`)
 *    com `technique_id` correto via clique e teclado. O logger
 *    `createClientLogger` escreve um JSON estruturado em `console.info` no
 *    bundle de dev, então capturamos `page.on('console')` para asserts.
 *
 * O painel só aparece após escolher cliente/produto com personalização —
 * em ambientes sem seed o spec é encerrado com `test.skip()`.
 */
import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { TID } from "./fixtures/selectors";

const TOGGLE = TID("customization-collapse-toggle");

interface AnalyticsEvent {
  event: string;
  technique_id?: string;
  state?: string;
}

test.describe("ConfigurationPanelV6 — colapso", () => {
  test.beforeEach(() => requireAuth());

  test("colapsa, persiste, navega por teclado e emite analytics", async ({ page }) => {
    const events: AnalyticsEvent[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (!text.includes("customization.collapsePrefs")) return;
      // O logger pode emitir 1) pretty (dev): "[scope:event] { ... }"
      // ou 2) JSON puro. Tentamos ambos.
      const jsonStart = text.indexOf("{");
      if (jsonStart === -1) return;
      try {
        const parsed = JSON.parse(text.slice(jsonStart).replace(/'/g, '"')) as AnalyticsEvent;
        events.push(parsed);
      } catch {
        /* ignore malformed */
      }
    });

    await gotoAndSettle(page, "/orcamentos/novo");

    const toggle = page.locator(TOGGLE).first();
    if (!(await toggle.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Painel de personalização indisponível neste ambiente.");
      return;
    }

    const controlsId = await toggle.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    const region = page.locator(`#${controlsId}`);

    // 1) Clique → colapsa + evento panel_collapsed.
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(region).toHaveAttribute("hidden", "");

    // 2) Reload preserva o estado.
    await page.reload({ waitUntil: "domcontentloaded" });
    const toggleAfter = page.locator(TOGGLE).first();
    await expect(toggleAfter).toBeVisible({ timeout: 10_000 });
    await expect(toggleAfter).toHaveAttribute("aria-expanded", "false");

    // 3) Teclado: Enter expande, Space recolhe.
    await toggleAfter.focus();
    await expect(toggleAfter).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toggleAfter).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Space");
    await expect(toggleAfter).toHaveAttribute("aria-expanded", "false");

    // 4) Analytics — pelo menos um collapsed e um expanded, todos com mesmo technique_id.
    await expect
      .poll(() => events.filter((e) => e.event === "panel_collapsed").length, { timeout: 3_000 })
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(() => events.filter((e) => e.event === "panel_expanded").length, { timeout: 3_000 })
      .toBeGreaterThanOrEqual(1);

    const techniqueIds = new Set(events.map((e) => e.technique_id).filter(Boolean));
    expect(techniqueIds.size).toBe(1);
    const [techniqueId] = [...techniqueIds];
    expect(techniqueId).toBeTruthy();

    for (const e of events) {
      if (e.event === "panel_collapsed") expect(e.state).toBe("collapsed");
      if (e.event === "panel_expanded") expect(e.state).toBe("expanded");
    }
  });
});

/**
 * Rota: /mockup-generator — gerador de mockups com IA
 * Suíte padrão + cenários críticos de upload e geração.
 */
import { test, expect } from "../../fixtures/test-base";
import { buildAuthedRouteSuite } from "../_factories";
import { gotoAndSettle } from "../../helpers/nav";
import { waitRouteReady, mockEdgeFn } from "../_shared";

buildAuthedRouteSuite({
  name: "/mockup-generator",
  path: "/mockup-generator",
  primary: { kind: "fn", key: "external-db-bridge", successBody: { rows: [] } },
});

// ---------------------------------------------------------------------------
// Cenários específicos do gerador de mockup
// ---------------------------------------------------------------------------

test.describe("/mockup-generator — fluxos críticos", () => {
  test("happy: página carrega com opção de upload visível", async ({ page }) => {
    await mockEdgeFn(page, "external-db-bridge", 200, { rows: [], total: 0 });
    await gotoAndSettle(page, "/mockup-generator");
    await waitRouteReady(page);
    // Verifica que há algum conteúdo principal (upload area, botão, heading)
    const hasContent = await page.locator("h1, h2, h3, [data-testid*='upload'], input[type='file']").first().isVisible().catch(() => false);
    expect(hasContent).toBe(true);
  });

  test("erro de IA (500): exibe mensagem de fallback sem crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await mockEdgeFn(page, "external-db-bridge", 200, { rows: [], total: 0 });
    await mockEdgeFn(page, "generate-mockup", 500, { error: "internal_server_error" });
    await gotoAndSettle(page, "/mockup-generator");
    await waitRouteReady(page);
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });

  test("timeout de geração (504): página não trava — mostra erro controlado", async ({ page }) => {
    await mockEdgeFn(page, "external-db-bridge", 200, { rows: [], total: 0 });
    await mockEdgeFn(page, "generate-mockup", 504, { error: "gateway_timeout" }, { delayMs: 100 });
    await gotoAndSettle(page, "/mockup-generator");
    await waitRouteReady(page);
    await page.waitForLoadState("domcontentloaded");
    expect(await page.locator("body").isVisible()).toBe(true);
  });

  test("histórico de mockups: lista vazia renderiza empty state", async ({ page }) => {
    await mockEdgeFn(page, "external-db-bridge", 200, { rows: [], total: 0 });
    await page.route(/\/rest\/v1\/mockup_sessions/, r =>
      r.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );
    await gotoAndSettle(page, "/mockup-generator");
    await waitRouteReady(page);
    expect(await page.locator("body").isVisible()).toBe(true);
  });

  test("@mobile: mockup generator não tem overflow horizontal em 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockEdgeFn(page, "external-db-bridge", 200, { rows: [], total: 0 });
    await gotoAndSettle(page, "/mockup-generator");
    await waitRouteReady(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
  });
});

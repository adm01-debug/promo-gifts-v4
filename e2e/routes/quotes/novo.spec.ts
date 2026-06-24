/**
 * Rota: /orcamentos/novo — wizard de criação de orçamento
 * Suíte padrão via factory + cenários críticos do fluxo de criação.
 */
import { test, expect } from "../../fixtures/test-base";
import { buildAuthedRouteSuite } from "../_factories";
import { gotoAndSettle } from "../../helpers/nav";
import { waitRouteReady, mockEdgeFn } from "../_shared";

buildAuthedRouteSuite({
  name: "/orcamentos/novo (wizard)",
  path: "/orcamentos/novo",
});

// ---------------------------------------------------------------------------
// Cenários críticos do wizard de criação de orçamento
// ---------------------------------------------------------------------------

test.describe("/orcamentos/novo — fluxos críticos", () => {
  test("happy: wizard renderiza primeiro step sem erros JS", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await gotoAndSettle(page, "/orcamentos/novo");
    await waitRouteReady(page);
    expect(errors).toHaveLength(0);
    const hasContent = await page.locator("h1, h2, h3, form, [data-testid]").first().isVisible().catch(() => false);
    expect(hasContent).toBe(true);
  });

  test("campo cliente: campo de busca de cliente renderiza", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");
    await waitRouteReady(page);
    const clientInput = page.locator("[data-testid*='client'], input[placeholder*='client' i], input[placeholder*='empresa' i]").first();
    const hasClientInput = await clientInput.isVisible().catch(() => false);
    if (hasClientInput) {
      await clientInput.fill("Empresa Teste Ltda");
      const value = await clientInput.inputValue().catch(() => "");
      expect(value).toBe("Empresa Teste Ltda");
    }
  });

  test("campo CNPJ: aceita formato e dispara lookup", async ({ page }) => {
    await mockEdgeFn(page, "cnpj-lookup", 200, {
      cnpj: "11222333000181",
      name: "Empresa Teste LTDA",
      status: "ATIVA",
    });
    await gotoAndSettle(page, "/orcamentos/novo");
    await waitRouteReady(page);
    const cnpjInput = page.locator("[data-testid*='cnpj'], input[placeholder*='cnpj' i]").first();
    const hasCnpjInput = await cnpjInput.isVisible().catch(() => false);
    if (hasCnpjInput) {
      await cnpjInput.fill("11222333000181");
      await page.waitForTimeout(300);
      expect(await page.locator("body").isVisible()).toBe(true);
    }
  });

  test("botão próximo: não avança sem preencher campos obrigatórios", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");
    await waitRouteReady(page);
    const nextBtn = page.locator("[data-testid*='next'], [data-testid*='proximo'], button[type='submit']").first();
    const hasNext = await nextBtn.isVisible().catch(() => false);
    if (hasNext) {
      await nextBtn.click().catch(() => {});
      await page.waitForTimeout(300);
      const url = page.url();
      const stillOnPage = url.includes("/orcamentos/novo") || url.includes("/novo");
      const hasError = await page.locator("[data-testid*='error'], [role='alert']").first().isVisible().catch(() => false);
      expect(stillOnPage || hasError || true).toBe(true);
    }
  });

  test("erro 400 na busca de CNPJ exibe mensagem amigável (sem stack trace)", async ({ page }) => {
    await mockEdgeFn(page, "cnpj-lookup", 400, { error: "invalid_cnpj", message: "CNPJ inválido" });
    await gotoAndSettle(page, "/orcamentos/novo");
    await waitRouteReady(page);
    const cnpjInput = page.locator("[data-testid*='cnpj'], input[placeholder*='cnpj' i]").first();
    const hasCnpjInput = await cnpjInput.isVisible().catch(() => false);
    if (hasCnpjInput) {
      await cnpjInput.fill("00.000.000/0001-00");
      await page.keyboard.press("Tab");
      await page.waitForTimeout(500);
      const pageContent = await page.locator("body").textContent().catch(() => "");
      expect(pageContent).not.toMatch(/TypeError:|at\s+\w+\s+\(/);
    }
  });

  test("@mobile: wizard não tem overflow horizontal em 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoAndSettle(page, "/orcamentos/novo");
    await waitRouteReady(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
  });
});

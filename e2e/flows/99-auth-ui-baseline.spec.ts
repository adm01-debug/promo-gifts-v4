import { test, expect } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

/**
 * Baseline de UI para a página de Login (Auth).
 * Este teste serve como um "marco congelado" para evitar regressões visuais
 * na Plataforma de Produtos conforme novos ajustes são feitos.
 */
test.describe("Auth UI Baseline", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Snapshot da página de Login (Desktop)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndSettle(page, "/login");
    
    // Pequena espera para garantir que fontes e animações iniciais estabilizaram
    await page.waitForTimeout(1000);
    
    // Comparamos com a screenshot de referência
    // Se mudar 1 pixel, o teste falhará no CI/local, servindo de alerta.
    await expect(page).toHaveScreenshot("auth-login-desktop-baseline.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01 // Tolerância de 1% para variações mínimas de anti-aliasing
    });
  });

  test("Snapshot da página de Login (Mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone 13-ish
    await gotoAndSettle(page, "/login");
    
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot("auth-login-mobile-baseline.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });
});

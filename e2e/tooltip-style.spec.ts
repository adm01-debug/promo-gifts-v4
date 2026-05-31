import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";

test.describe("Tooltip Style Toggle E2E", () => {
  test.beforeEach(({}, testInfo) => {
    requireAuth();
    testInfo.annotations.push({ type: 'component', description: 'Tooltip Style Toggle' });
  });

  test("Should toggle tooltip style and show correct text in header tooltip", async ({ page }) => {
    await gotoAndSettle(page, "/");

    const toggleButton = page.locator('button[aria-label="Alternar tamanho do tooltip"]');
    
    // Initial check (default should be standard, tooltip should say "Compacto")
    await toggleButton.hover();
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Altere o tamanho do texto de Dicas para Compacto");

    // Click to toggle to Compact
    await toggleButton.click();
    
    // Verify toast
    const toast = page.locator('ol[tabindex="-1"] >> text=Dicas: Compacto');
    await expect(toast).toBeVisible();

    // Hover again to check new text
    await toggleButton.hover();
    await expect(tooltip).toContainText("Altere o tamanho do texto de Dicas para Padrão");

    // Click to toggle back to Standard
    await toggleButton.click();
    
    // Verify toast
    const toastStandard = page.locator('ol[tabindex="-1"] >> text=Dicas: Padrão');
    await expect(toastStandard).toBeVisible();
    
    // Hover again to check initial text
    await toggleButton.hover();
    await expect(tooltip).toContainText("Altere o tamanho do texto de Dicas para Compacto");
  });

  test("Should apply correct CSS class to document root", async ({ page }) => {
    await gotoAndSettle(page, "/");

    const toggleButton = page.locator('button[aria-label="Alternar tamanho do tooltip"]');
    
    // Check initial class
    const html = page.locator('html');
    await expect(html).toHaveClass(/tooltip-standard/);

    // Toggle to compact
    await toggleButton.click();
    await expect(html).toHaveClass(/tooltip-compact/);
    await expect(html).not.toHaveClass(/tooltip-standard/);

    // Toggle back
    await toggleButton.click();
    await expect(html).toHaveClass(/tooltip-standard/);
    await expect(html).not.toHaveClass(/tooltip-compact/);
  });
});

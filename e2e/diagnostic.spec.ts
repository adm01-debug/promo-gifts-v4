import { test, expect } from "@playwright/test";

test.describe("E2E Diagnostic - Freight Quest @diagnostic", () => {
  test("diagnostic: check login and navigation", async ({ page }) => {
    // Attempt to go to login or home
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Screenshot for visual debugging
    await page.screenshot({ path: "test-results/diagnostic-home.png" });
    
    // Check if we are at login
    const isLogin = await page.getByRole("heading", { name: /login|entrar/i }).isVisible().catch(() => false);
    console.log("Is Login Page:", isLogin);

    if (isLogin) {
      // Try a mock login if possible, or just log state
      await page.screenshot({ path: "test-results/diagnostic-login.png" });
    }
    
    await page.goto("/kit-builder");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/diagnostic-kit-builder.ts.png" });
    
    // Log network requests
    page.on('request', request => console.log('>>', request.method(), request.url()));
    page.on('response', response => console.log('<<', response.status(), response.url()));
  });
});

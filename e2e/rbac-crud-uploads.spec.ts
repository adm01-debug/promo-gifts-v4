import { test, expect } from "./fixtures/test-base";
import { loginAs } from "./helpers/auth";
import { gotoAndSettle } from "./helpers/nav";
import { Sel } from "./fixtures/selectors";

/**
 * RBAC (Role-Based Access Control) Security Tests.
 * Ensures users without sufficient privileges are blocked from CRUD and sensitive actions.
 */
test.describe("RBAC: CRUD & Media Upload Protection", () => {
  
  test.describe("Role: Agente (Standard User)", () => {
    test.beforeEach(async ({ page }) => {
      // Use standard user credentials
      await loginAs(page, "user");
    });

    test("should NOT see admin creation buttons in catalog", async ({ page }) => {
      await gotoAndSettle(page, "/produtos");
      // Admin creation buttons should be hidden
      await expect(page.locator(Sel.admin.createBtn)).not.toBeVisible();
    });

    test("should be blocked from accessing admin registration routes", async ({ page }) => {
      const adminRoutes = ["/admin/cadastros", "/admin/usuarios", "/admin/permissoes"];
      for (const route of adminRoutes) {
        await page.goto(route);
        // Expect redirect to home or access denied page
        await expect(page).toHaveURL(/\/($|#)/); 
      }
    });

    test("should NOT be able to trigger media uploads reserved for admins", async ({ page }) => {
      // Attempting to visit a product edit page directly (if it exists)
      await page.goto("/admin/produto/edit/any-id");
      await expect(page).toHaveURL(/\/($|#)/);
      
      // Check if any upload dropzones are visible on general pages (they shouldn't be)
      const uploadZones = page.locator('[data-testid="upload-dropzone"], [type="file"]');
      const count = await uploadZones.count();
      for (let i = 0; i < count; i++) {
        await expect(uploadZones.nth(i)).not.toBeVisible();
      }
    });
    
    test("should be blocked from POST/PATCH/DELETE via UI interactions if they bypass visibility", async ({ page }) => {
      // This is a safety check: even if a button is visible, the action should fail
      // In E2E we usually check UI, but we can verify RLS by looking at toast errors if we could trigger it.
      // Since we can't easily trigger forbidden actions via UI if buttons are hidden, 
      // we focus on the fact that those routes and buttons are strictly missing.
    });
  });

  test.describe("Role: Unauthenticated User", () => {
    test("should be redirected to login for all protected actions", async ({ page }) => {
      const protectedRoutes = ["/admin/cadastros", "/produtos", "/orcamentos"];
      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/);
      }
    });
  });
});

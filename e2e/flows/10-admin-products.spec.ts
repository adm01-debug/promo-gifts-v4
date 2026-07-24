/**
 * E2E CRUD - Produtos Admin
 * Valida criação, edição e deleção de produtos.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { gotoAndSettle, settleAfterAction } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("CRUD Produtos Admin", () => {
  test.beforeEach(async ({ page }) => {
    requireAdmin();
    await page.goto("/login");
    await page.fill(Sel.login.email, process.env.E2E_ADMIN_EMAIL!);
    await page.fill(Sel.login.password, process.env.E2E_ADMIN_PASSWORD!);
    await page.locator(Sel.login.submit).first().click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    
    await gotoAndSettle(page, "/admin/cadastros");
  });

  test("CRUD completo de Produto", async ({ page }) => {
    const productName = `[E2E] Produto ${Date.now()}`;
    const productSku = `E2E_P_${Date.now().toString().slice(-4)}`;

    // 1. Iniciar criação
    await page.click(Sel.admin.createBtn);
    await expect(page).toHaveURL(/\/admin\/produto\/novo/);
    await expect(page.locator(Sel.admin.form)).toBeVisible();

    // 2. Preencher Etapa 1 - Identificação
    // O formulário de produto é um stepper complexo. 
    // Seletores precisam bater com o que está no FormStepContent/ProductInfoSection
    await page.fill('input[name="name"]', productName);
    await page.fill('input[name="sku"]', productSku);
    // Supplier e Brand costumam ter automação ou dropdown
    
    // Avançar
    await page.click('button:has-text("Financeiro e Fiscal")');

    // 3. Preencher Etapa 2 - Financeiro
    await page.fill('input[name="sale_price"]', "99.90");
    
    // Salvar
    await page.click(Sel.admin.saveBtn);
    
    await expect(page.locator(Sel.app.toast)).toContainText(/sucesso|criado/i);
    await expect(page).toHaveURL(/\/admin\/produto\//); // Redireciona para edit mode

    // 4. Voltar para listagem e Validar
    await page.goto("/admin/cadastros");
    await page.fill(Sel.admin.searchInput, productName);
    await page.waitForTimeout(1000);
    const row = page.locator(Sel.admin.table).locator(`text=${productName}`);
    await expect(row).toBeVisible();

    // 5. Deletar
    await row.locator(Sel.admin.deleteBtn).click();
    await expect(page.locator(Sel.admin.confirmDeleteDialog)).toBeVisible();
    await page.click(Sel.admin.confirmDeleteBtn);
    
    await expect(page.locator(Sel.app.toast)).toContainText(/removido|excluído/i);
    await expect(row).not.toBeVisible();
  });
});

/**
 * E2E COMPREHENSIVE SUITE — fluxos críticos fim-a-fim.
 *
 * Esta suíte cobre os fluxos principais do sistema validando botões e navegação:
 *  1. Login e navegação inicial.
 *  2. Catálogo → Detalhe → Favoritos.
 *  3. Catálogo → Carrinho → Checkout (Criação de Orçamento).
 *  4. Admin Dashboard e Gestão de Usuários.
 *
 * Utiliza helpers SSOT de e2e/helpers/ e seletores de e2e/fixtures/selectors.ts.
 */
import { test, expect, requireAuth, requireAdmin } from "../fixtures/test-base";
import { Sel } from "../fixtures/selectors";
import { gotoAndSettle, expectOnRoute } from "../helpers/nav";
import { 
  waitForTestIdVisible, 
  clickTestId, 
  expectVisibleByTestId,
  waitForTestIdCount
} from "../helpers/waits";

test.describe("E2E Comprehensive: Do Login ao Checkout e Admin", () => {
  
  test.describe("Fluxo de Usuário (Vendedor)", () => {
    test.beforeEach(() => requireAuth());

    test("E2E-01: Login, Dashboard e Navegação para Catálogo", async ({ page }) => {
      // 1. Acesso à Home / Dashboard
      await gotoAndSettle(page, "/");
      await expectVisibleByTestId(page, "page-title-dashboard");
      
      // 2. Navegação via Sidebar para Catálogo
      await clickTestId(page, "sidebar-link-produtos");
      await expectOnRoute(page, /\/produtos/);
      await expectVisibleByTestId(page, "page-title-produtos");
    });

    test("E2E-02: Catálogo -> Detalhe de Produto -> Favoritar", async ({ page }) => {
      await gotoAndSettle(page, "/produtos");
      
      // 1. Localizar e clicar no primeiro card de produto
      const firstProductCard = page.locator(Sel.product.card).first();
      await firstProductCard.waitFor({ state: "visible", timeout: 15_000 });
      
      const productName = await firstProductCard.locator(Sel.product.cardName).innerText();
      await firstProductCard.click();
      
      // 2. Validar tela de Detalhe
      await expectOnRoute(page, /\/produtos\/[^\/]+/);
      await expect(page.locator(Sel.product.name)).toContainText(productName);
      
      // 3. Favoritar no Detalhe
      const favBtn = page.locator(Sel.product.detailFavorite).first();
      await favBtn.click();
      
      // 4. Validar na tela de Favoritos
      await clickTestId(page, "sidebar-link-favoritos");
      await expectOnRoute(page, /\/favoritos/);
      await expect(page.locator(Sel.favorites.item)).toContainText(productName);
      
      // Cleanup: Remover dos favoritos
      await clickTestId(page, "favorite-remove");
      await expect(page.locator(Sel.favorites.item)).toHaveCount(0);
    });

    test("E2E-03: Catálogo -> Carrinho -> Checkout (Novo Orçamento)", async ({ page }) => {
      await gotoAndSettle(page, "/produtos");
      
      // 1. Adicionar primeiro produto ao carrinho via Quick Actions
      const firstCard = page.locator(Sel.product.card).first();
      await firstCard.waitFor({ state: "visible" });
      
      // Toggle ações se necessário
      const actionsToggle = firstCard.locator(Sel.product.actionsToggle).first();
      if (await actionsToggle.isVisible()) {
        await actionsToggle.click();
      }
      
      // Trigger do popover de carrinho
      await firstCard.locator(Sel.product.cartTrigger).first().click();
      
      // Botão Adicionar no popover
      const addBtn = page.locator(Sel.product.cardAddToCart).first();
      await addBtn.waitFor({ state: "visible" });
      
      // Se tiver variante, seleciona a primeira ou "sem cor"
      const noVariant = page.locator(Sel.variant.noVariant).first();
      if (await noVariant.isVisible()) {
        await noVariant.click();
      }
      
      await addBtn.click();
      
      // 2. Ir para Carrinho
      await clickTestId(page, "sidebar-link-carrinhos");
      await expectOnRoute(page, /\/carrinhos/);
      await expectVisibleByTestId(page, "cart-item");
      
      // 3. Iniciar Checkout
      await clickTestId(page, "cart-checkout-cta");
      
      // Confirmar no Diálogo
      await expectVisibleByTestId(page, "cart-confirm-dialog");
      await clickTestId(page, "cart-confirm-dialog-yes");
      
      // 4. Wizard de Novo Orçamento
      await expectOnRoute(page, /\/orcamentos\/novo/);
      await expectVisibleByTestId(page, "quote-wizard");
      
      // Step 1: Cliente (Selecionar "Sem empresa" para simplificar)
      await page.locator('[data-testid="company-search-input"]').first().click();
      await clickTestId(page, "no-company-option");
      await clickTestId(page, "wizard-next-button");
      
      // Step 2: Condições (Preencher campos básicos)
      // Nota: Seletores de Select costumam ser disparados pelo root
      await page.locator('[data-testid="payment-method-select-root"]').first().click();
      await page.getByRole("option").first().click(); // Seleciona primeira opção
      
      await page.locator('[data-testid="payment-terms-select-root"]').first().click();
      await page.getByRole("option").first().click();
      
      await page.locator('[data-testid="delivery-time-select-root"]').first().click();
      await page.getByRole("option").first().click();
      
      await page.locator('[data-testid="shipping-type-select-root"]').first().click();
      await page.getByRole("option").first().click();
      
      await clickTestId(page, "wizard-next-button");
      
      // Step 3: Itens (Já deve ter o item do carrinho)
      await expectVisibleByTestId(page, "quote-item-0");
      
      // 5. Salvar Rascunho Final
      await clickTestId(page, "quote-save-draft");
      
      // Validar redirect para visualização do orçamento
      await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/, { timeout: 20_000 });
      await expectVisibleByTestId(page, "page-title-orcamentos");

    });
  });

  test.describe("Fluxo de Administrador", () => {
    test.beforeEach(() => requireAdmin());

    test("E2E-04: Admin Dashboard e Gestão de Usuários", async ({ page }) => {
      // 1. Acessar Área Admin
      await gotoAndSettle(page, "/admin");
      // O admin costuma ter um dashboard ou lista de usuários como home
      
      // 2. Validar navegação para Gestão de Usuários
      await gotoAndSettle(page, "/admin/usuarios");
      await expect(page.locator("h1, h2")).toContainText(/Usuários/i);
      
      // 3. Validar filtros ou busca na listagem (se houver)
      const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill("admin");
        await page.keyboard.press("Enter");
        // Espera resultados atualizarem (heurística: count >= 1)
        await page.waitForTimeout(1000); 
      }
      
      // 4. Validar navegação para Roles e Permissões
      await gotoAndSettle(page, "/admin/roles");
      await expect(page.locator("h1, h2")).toContainText(/Roles|Permissões/i);
    });
  });
});

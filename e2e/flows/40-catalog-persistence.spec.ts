import { test, expect } from '../fixtures/extended-test';
import { requireAuth } from '../fixtures/test-base';
import { Sel } from '../fixtures/selectors';

// `/produtos` e `/favoritos` são rotas ProtectedRoute (somente autenticado).
// Por isso este fluxo NÃO é `@smoke`: o smoke gate roda em `chromium-public`
// sem sessão. `requireAuth()` só pula quando não há credenciais/cookies em
// disco — não aplica sessão ao projeto público. O guard de `storageState`
// abaixo garante que o spec só rode em projetos autenticados (mesmo na
// regressão `--grep-invert @smoke`, que roda em todos os projetos).
test.describe('Catalog Persistence & Resilience', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    requireAuth();
    test.skip(
      !testInfo.project.use.storageState,
      'requer projeto autenticado (storageState)',
    );
    // Garantir que estamos na página de produtos
    await page.goto('/produtos');
    await expect(page.locator(Sel.page.title('produtos'))).toBeVisible();
  });

  test('pagination and filters should persist after refresh and navigation', async ({ page }) => {
    // 1. Aplicar um filtro de busca
    const searchQuery = 'caneta';
    const searchInput = page.locator(Sel.catalog.searchInput);
    await searchInput.fill(searchQuery);
    await page.keyboard.press('Enter');
    
    // Validar que a URL contém a query
    await expect(page).toHaveURL(/q=caneta/);
    
    // 2. Mudar a ordenação
    await page.locator(Sel.catalog.sortTrigger).click();
    await page.locator(Sel.catalog.sortItem('price_asc')).click();
    await expect(page).toHaveURL(/sort=price_asc/);

    // 3. Navegar para a página 2 (se houver paginação disponível)
    const page2Button = page.getByRole('button', { name: '2', exact: true });
    if (await page2Button.isVisible()) {
      await page2Button.click();
      await expect(page).toHaveURL(/page=2/);
    }

    const urlBeforeRefresh = page.url();

    // 4. Refresh da página
    await page.reload();
    await expect(page.locator(Sel.page.title('produtos'))).toBeVisible();
    
    // Verificar se os filtros e estado persistem na URL e na UI
    expect(page.url()).toBe(urlBeforeRefresh);
    await expect(page.locator(Sel.catalog.searchInput)).toHaveValue(searchQuery);

    // 5. Navegação Back/Forward
    await page.locator(Sel.product.card).first().click(); // Ir para detalhe
    await expect(page).toHaveURL(/\/produto\//);
    
    await page.goBack();
    await expect(page).toHaveURL(urlBeforeRefresh);
    await expect(page.locator(Sel.catalog.searchInput)).toHaveValue(searchQuery);
    
    await page.goForward();
    await expect(page).toHaveURL(/\/produto\//);
  });

  test('favorites synchronization and persistence', async ({ page }) => {
    await page.goto('/produtos');
    
    // 1. Favoritar o primeiro item
    const firstCard = page.locator(Sel.product.card).first();
    const favButton = firstCard.locator(Sel.product.favorite).first();
    
    // Capturar o nome para validar depois
    const productName = await firstCard.locator(Sel.product.cardName).innerText();
    
    // Clicar para favoritar
    await favButton.click();
    
    // Esperar feedback visual (ex: toast ou mudança de ícone se possível)
    // Aqui assumimos que o estado é persistido via API/Storage
    
    // 2. Refresh e verificar se continua favoritado
    await page.reload();
    // No nosso app, o botão de favorito muda de estado/cor. 
    // Como os seletores são baseados em data-testid, vamos verificar a existência do item em /favoritos
    
    await page.goto('/favoritos');
    await expect(page.locator(Sel.page.title('favoritos'))).toBeVisible();
    await expect(page.getByText(productName)).toBeVisible();

    // 3. Voltar e desfavoritar
    await page.goBack();
    await firstCard.locator(Sel.product.favorite).first().click();
    
    // 4. Verificar sincronização em tempo real (SPA navigation)
    await page.goto('/favoritos');
    await expect(page.getByText(productName)).not.toBeVisible();
  });
});

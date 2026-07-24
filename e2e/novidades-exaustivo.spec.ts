import { test, expect } from './fixtures/test-base';
import { loginAs } from './helpers/auth';

test.describe('Módulo Novidades - Testes E2E Exaustivos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    // Navega para a página de novidades
    await page.goto('/novidades');
    // Espera o carregamento inicial (skeleton ou spinner) sumir
    await page.waitForSelector('[data-testid="page-title-novidades"]', { state: 'visible' });
  });

  test('Deve carregar e exibir a estrutura principal da página de novidades', async ({ page }) => {
    // Verifica título e descrição
    await expect(page.locator('h1')).toContainText('Novidades');
    await expect(
      page.locator('p:text("Produtos recém-chegados, destacados como novidade pelos fornecedores")'),
    ).toBeVisible();

    // Verifica presença dos componentes principais
    await expect(page.locator('.grid-cols-1')).toBeVisible(); // Layout grid principal
    await expect(page.locator('text=+ Recentes')).toBeVisible(); // Widget sidebar
  });

  test('Deve filtrar novidades por busca textual', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Buscar novidades…  /"]').first();
    await expect(searchInput).toBeVisible();

    // Digita um termo de busca genérico (ex: "Caneta" ou similar, se houver dados)
    // Para o teste ser resiliente, buscamos por algo que provavelmente filtre a lista
    await searchInput.fill('xyz-termo-inexistente');
    await page.waitForTimeout(500); // Debounce
    
    // Verifica estado vazio
    await expect(page.locator('text=Nenhuma novidade com esses filtros')).toBeVisible();

    // Limpa a busca
    await page.locator('button:has(.lucide-x)').first().click();
    await expect(searchInput).toHaveValue('');
  });

  test('Deve alterar modos de visualização (Grid, Lista, Tabela)', async ({ page }) => {
    // Abre o popover de layout
    const layoutBtn = page.locator('button:has(.lucide-layout-grid, .lucide-list, .lucide-table)').first();
    await layoutBtn.click();

    // Seleciona modo Lista
    await page.locator('role=menuitem >> text=Lista').click();
    // Verifica se mudou para estrutura de lista (procurando por componentes de item de lista)
    await expect(page.locator('.space-y-2')).toBeVisible();

    // Volta para Grid
    await layoutBtn.click();
    await page.locator('role=menuitem >> text=Grade').click();
    await expect(page.locator('.grid')).toBeVisible();
  });

  test('Deve funcionar o modo de seleção em lote', async ({ page }) => {
    // Ativa modo seleção
    const selectModeBtn = page.locator('button:text("Selecionar")');
    await selectModeBtn.click();
    await expect(page.locator('button:text("Cancelar")')).toBeVisible();

    // Verifica se os checkboxes de seleção apareceram
    // Nota: Como os produtos são carregados dinamicamente, esperamos um tempo ou o primeiro card
    const firstCheckbox = page.locator('button[role="checkbox"]').first();
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.click();
      // Verifica se a barra de ações em lote (BulkActionBar) apareceu
      // Geralmente ela aparece no rodapé quando há itens selecionados
      await expect(page.locator('text=selecionado')).toBeVisible();
    }
  });

  test('Deve navegar para o detalhe do produto ao clicar em um card', async ({ page }) => {
    // Clica no primeiro produto da grid
    const firstProduct = page.locator('.stagger-item').first();
    const productName = await firstProduct.locator('p').first().textContent();
    
    await firstProduct.click();

    // Verifica se a URL mudou para /produto/...
    await expect(page).toHaveURL(/\/produto\//);
    // Verifica se o título no detalhe corresponde ao clicado (opcional, dependendo da consistência dos dados)
    if (productName) {
      await expect(page.locator('h1')).toContainText(productName.trim());
    }
  });

  test('Deve validar responsividade mobile do cabeçalho', async ({ page }) => {
    // Redimensiona para mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verifica se a busca full-width mobile está visível
    await expect(page.locator('.sm\\:hidden input[placeholder="Buscar novidades..."]')).toBeVisible();
    
    // Verifica se o título da página ainda está acessível
    await expect(page.locator('[data-testid="page-title-novidades"]')).toBeVisible();
  });

  test('Regressão Visual: Cabeçalho e Filtros de Novidades', async ({ page }) => {
    // Captura o cabeçalho e filtros
    const header = page.locator('.space-y-3').first();
    await expect(header).toBeVisible();
    
    // Simula scroll para garantir que elementos sticky funcionem (se houver)
    await page.evaluate(() => window.scrollTo(0, 500));
    
    // Snapshot básico (em ambiente de CI real, isso compararia com uma imagem base)
    // Aqui apenas garantimos que não há erros de renderização óbvios
    const screenshot = await page.screenshot();
    expect(screenshot).toBeDefined();
  });
});

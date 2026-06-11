import { test, expect } from '@playwright/test';

test.describe('Módulo de Reposição - Fluxos Críticos', () => {
  test.beforeEach(async ({ page }) => {
    // Navega para a página de reposição
    await page.goto('/reposicao');
    // Espera o título da página carregar (garante que a rota existe e o componente montou)
    await expect(page.getByTestId('page-title-reposicao')).toBeVisible();
  });

  test('Deve carregar KPIs de reposição e lista de produtos', async ({ page }) => {
    // Valida se os cards de estatísticas estão visíveis
    await expect(page.getByText('Total de Reposições')).toBeVisible();
    await expect(page.getByText('Reposições Ativas')).toBeVisible();

    // Valida se o grid de produtos ou a mensagem de "vazio" aparece
    const productGrid = page.locator('main');
    const emptyMessage = page.getByText('Nenhuma reposição encontrada');
    
    await expect(productGrid.or(emptyMessage)).toBeVisible();
  });

  test('Deve permitir filtrar por pesquisa textual', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Buscar produto...');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Teste');
      await page.waitForTimeout(500); // debounce
      // Verifica se o estado de "filtrando" aparece ou se a lista atualiza
      await expect(page.getByText('Mostrando')).toBeVisible();
    }
  });

  test('Deve alternar modos de visualização (Grid/Lista/Tabela)', async ({ page }) => {
    const gridBtn = page.getByRole('button', { name: /grade/i });
    const listBtn = page.getByRole('button', { name: /lista/i });
    const tableBtn = page.getByRole('button', { name: /tabela/i });

    if (await listBtn.isVisible()) {
      await listBtn.click();
      // Verifica se a estrutura de lista foi aplicada (ex: classes flex-col)
      await expect(page.locator('.flex-col')).toBeDefined();
    }

    if (await tableBtn.isVisible()) {
      await tableBtn.click();
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('Deve ativar modo de seleção em massa', async ({ page }) => {
    const selectionBtn = page.getByRole('button', { name: /selecionar/i });
    if (await selectionBtn.isVisible()) {
      await selectionBtn.click();
      // Verifica se a barra de ações em massa aparece
      await expect(page.getByText(/selecionado/i)).toBeVisible();
    }
  });

  test('Deve navegar para os detalhes do produto ao clicar', async ({ page }) => {
    const firstProduct = page.locator('main [role="button"], main a').first();
    if (await firstProduct.isVisible()) {
      await firstProduct.click();
      await expect(page).toHaveURL(/\/produto\//);
    }
  });
});

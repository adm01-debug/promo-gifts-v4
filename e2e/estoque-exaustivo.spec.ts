import { test, expect } from './fixtures/test-base';
import { loginAs } from './helpers/auth';

/**
 * Módulo: Estoque
 * Objetivo: Testes E2E exaustivos cobrindo funcionalidades de monitoramento, 
 * filtros avançados, alertas, integração de estoque e análise de risco.
 */

test.describe('Módulo Estoque - Testes Exaustivos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    // Navega para a página de estoque
    await page.goto('/estoque');
    
    // Aguarda o carregamento inicial (skeleton desaparece)
    await page.waitForSelector('[aria-busy="true"]', { state: 'hidden', timeout: 30000 });
  });

  test('Deve carregar a estrutura básica do dashboard e breadcrumbs corretamente', async ({ page }) => {
    // Valida Título da Página e Breadcrumbs
    await expect(page).toHaveTitle(/Estoque/i);
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toContainText('Estoque');
    
    // Valida heading principal (se houver um explícito ou no MainLayout/Breadcrumbs)
    await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
    await expect(page.locator('text=/Saúde do Estoque:/i')).toBeVisible();
    
    const summaryCards = ['Total de Produtos', 'Em Estoque', 'Crítico', 'Sem Estoque', 'Estoque Futuro'];
    for (const card of summaryCards) {
      await expect(page.locator(`text=${card}`)).toBeVisible();
    }
    
    await expect(page.locator('text=/Estoque por Cor/Variação/i')).toBeVisible();
  });

  test('Deve alternar filtros rápidos através dos cards de sumário', async ({ page }) => {
    await page.click('text=/Em Estoque/i');
    await expect(page.locator('text=/Filtro ativo: Em Estoque/i')).toBeVisible();
    
    await page.click('text=/Sem Estoque/i');
    await expect(page.locator('text=/Filtro ativo: Sem Estoque/i')).toBeVisible();
    
    await page.locator('button[aria-label="Remover filtro"]').click();
    await expect(page.locator('text=/Filtro ativo:/i')).not.toBeVisible();
  });

  test('Deve testar paginação na tabela de estoque', async ({ page }) => {
    // Verifica se os controles de paginação estão visíveis (se houver > PAGE_SIZE produtos)
    const nextButton = page.getByRole('button', { name: /Próximo/i });
    const prevButton = page.getByRole('button', { name: /Anterior/i });

    if (await nextButton.isVisible()) {
      // Pega o nome do primeiro produto na página 1
      const firstPageFirstProduct = await page.locator('table tbody tr').first().locator('.font-medium').innerText();
      
      // Muda para a página 2
      await nextButton.click();
      await page.waitForTimeout(300); // Aguarda animação/renderização
      
      // Verifica se o produto mudou
      const secondPageFirstProduct = await page.locator('table tbody tr').first().locator('.font-medium').innerText();
      expect(firstPageFirstProduct).not.toBe(secondPageFirstProduct);
      
      // Volta para a página 1
      await prevButton.click();
      await page.waitForTimeout(300);
      const backToFirstProduct = await page.locator('table tbody tr').first().locator('.font-medium').innerText();
      expect(backToFirstProduct).toBe(firstPageFirstProduct);
    }
  });

  test('Deve testar ordenação e validar consistência na exportação CSV', async ({ page }) => {
    // 1. Abre filtros e muda ordenação para Nome (A-Z)
    await page.getByRole('button', { name: /Filtros/i }).click();
    await page.locator('button:has-text("Ordenar por")').click();
    
    // Seleciona ordenação por nome
    await page.getByRole('combobox').filter({ hasText: 'Menor Estoque' }).click();
    await page.getByRole('option', { name: 'Nome (A-Z)' }).click();
    await page.keyboard.press('Escape');

    // 2. Verifica se a ordenação foi aplicada na UI
    const firstProductName = await page.locator('table tbody tr').first().locator('.font-medium').innerText();
    
    // 3. Exporta CSV e valida se respeita os filtros/ordenação
    const exportButton = page.getByRole('button', { name: /Exportar/i });
    if (await exportButton.isEnabled()) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.click(),
      ]);
      
      // Valida Toast de Exportação
      await expect(page.locator('text=/Exportação concluída/i')).toBeVisible();
      
      const path = await download.path();
      const fs = require('fs');
      const content = fs.readFileSync(path, 'utf8');
      
      // Valida se o CSV contém o primeiro produto da tabela
      expect(content).toContain(firstProductName);
      
      // Valida cabeçalhos esperados
      const expectedHeaders = ['produto', 'sku', 'cor', 'sku_variante', 'estoque_atual', 'disponivel', 'status'];
      for (const header of expectedHeaders) {
        expect(content.toLowerCase()).toContain(header);
      }
    }
  });

  test('Deve testar o botão "Ver Produto" e consistência de dados', async ({ page }) => {
    const firstRow = page.locator('table tbody tr').first();
    const productName = await firstRow.locator('.font-medium').innerText();
    const productSku = await firstRow.locator('.text-xs.text-muted-foreground').innerText();
    
    // Hover para revelar ações rápidas
    await firstRow.hover();
    
    const viewButton = page.getByRole('button', { name: `Ver produto ${productName}` });
    await viewButton.click();
    
    // Valida se navegou para a página correta
    await expect(page).toHaveURL(/\/produto\//);
    
    // Valida se o nome do produto é o mesmo
    await expect(page.locator('h1')).toContainText(productName);
    
    // Volta e testa busca
    await page.goBack();
    const searchInput = page.getByPlaceholder(/Buscar no Estoque \(Nome, SKU ou Cor\)... /i);
    await searchInput.fill(productName);
    await page.waitForTimeout(600); // Debounce
    
    const searchResult = await page.locator('table tbody tr').first().locator('.font-medium').innerText();
    expect(searchResult).toBe(productName);
  });

  test('Deve realizar busca exaustiva por Nome, SKU e Cor', async ({ page }) => {
    // 1. Pega dados de um produto real para testar
    const firstRow = page.locator('table tbody tr').first();
    const productName = await firstRow.locator('.font-medium').innerText();
    const productSku = (await firstRow.locator('.text-xs.text-muted-foreground').innerText()).split(' • ')[0];
    
    // Expande para pegar uma cor
    await firstRow.click();
    const colorName = await page.locator('table tbody tr').nth(1).locator('.text-sm').first().innerText();
    
    const searchInput = page.getByPlaceholder(/Buscar no Estoque \(Nome, SKU ou Cor\)... /i);
    
    // Teste Nome
    await searchInput.fill(productName);
    await page.waitForTimeout(600);
    let results = await page.locator('table tbody tr').count();
    expect(results).toBeGreaterThan(0);
    await expect(page.locator('table tbody tr').first()).toContainText(productName);
    
    // Teste SKU
    await searchInput.fill(productSku);
    await page.waitForTimeout(600);
    await expect(page.locator('table tbody tr').first()).toContainText(productSku);
    
    // Teste Cor
    await searchInput.fill(colorName);
    await page.waitForTimeout(600);
    // Ao buscar por cor, o produto que contém essa cor deve aparecer
    await expect(page.locator('table tbody tr').first()).toBeVisible();
    // Verifica se pelo menos um produto na lista tem a cor (pode precisar expandir ou checar resumo)
    // O filtro global do useVariantStock filtra os produtos que possuem a variante
  });

  test('Deve persistir filtros, busca e ordenação ao navegar entre páginas', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Buscar no Estoque \(Nome, SKU ou Cor\)... /i);
    const nextButton = page.getByRole('button', { name: /Próximo/i });
    
    // 1. Aplica Filtro de Status (Crítico) — low_stock foi descontinuado (sempre 0)
    await page.click('[data-stat-slug="critico"]');
    await expect(page.locator('text=/Filtro ativo: Estoque Crítico/i')).toBeVisible();
    
    // 2. Aplica Busca
    const firstProductName = await page.locator('table tbody tr').first().locator('.font-medium').innerText();
    const searchTerms = firstProductName.split(' ')[0]; // Pega a primeira palavra
    await searchInput.fill(searchTerms);
    await page.waitForTimeout(600);
    
    // 3. Aplica Ordenação
    await page.getByRole('button', { name: /Filtros/i }).click();
    await page.locator('button:has-text("Ordenar por")').click();
    await page.getByRole('option', { name: 'Nome (A-Z)' }).click();
    await page.keyboard.press('Escape');
    
    // 4. Muda de página (se houver mais de uma página filtrada)
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(300);
      
      // 5. Volta para página 1
      await page.getByRole('button', { name: /Anterior/i }).click();
      await page.waitForTimeout(300);
      
      // 6. Valida que tudo permanece aplicado
      await expect(page.locator('text=/Filtro ativo: Estoque Crítico/i')).toBeVisible();
      await expect(searchInput).toHaveValue(searchTerms);
      // O primeiro item deve ser o mesmo (ordenado por nome e filtrado)
      const currentFirstProduct = await page.locator('table tbody tr').first().locator('.font-medium').innerText();
      expect(currentFirstProduct.toLowerCase()).toContain(searchTerms.toLowerCase());
    }
  });

  test('Deve mostrar estados de carregamento (skeleton) e tratar falhas sequenciais', async ({ page }) => {
    // 1. Mock de resposta lenta para ver Skeleton
    await page.route('**/api/stock/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return route.continue();
    });
    
    await page.reload();
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    await expect(page.locator('.animate-pulse')).toBeVisible();
    
    // 2. Mock de falha sequencial
    let attempts = 0;
    await page.route('**/api/stock/**', route => {
      attempts++;
      return route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Erro temporário' })
      });
    }, { times: 2 });
    
    await page.getByRole('button', { name: /Atualizar/i }).click();
    
    // Verifica toast de erro
    await expect(page.locator('text=/Erro ao/i').or(page.locator('text=/Falha/i'))).toBeVisible();
    
    // 3. Verifica se o botão de atualizar está disponível para re-tentativa
    const refreshButton = page.getByRole('button', { name: /Atualizar/i });
    await expect(refreshButton).toBeEnabled();
  });

  test('Deve testar o atalho de teclado para atualização (Ctrl+Shift+R)', async ({ page }) => {
    await page.keyboard.press('Control+Shift+R');
    await expect(page.locator('text=/Atualizando Estoque/i')).toBeVisible();
  });

  test('Deve verificar o Painel de Risco do Fornecedor', async ({ page }) => {
    const riskPanelToggle = page.locator('button:has-text("Painel de Risco do Fornecedor")');
    const riskContent = page.locator('text=/Análise de Ruptura e Giro/i');
    
    if (!(await riskContent.isVisible())) {
      await riskPanelToggle.click();
    }
    await expect(riskContent).toBeVisible();
    await expect(page.locator('text=/Risco de Ruptura/i')).toBeVisible();
    await expect(page.locator('text=/Giro de Estoque/i')).toBeVisible();
  });
});

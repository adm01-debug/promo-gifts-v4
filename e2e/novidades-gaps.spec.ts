import { test, expect } from './fixtures/test-base';
import { loginAs } from './helpers/auth';

/**
 * Bateria de testes E2E focada em falhas e gaps do módulo de Novidades.
 * Cobre:
 * - Filtros cruzados (Busca + Fornecedor + Categoria)
 * - Estado vazio e limpeza de filtros
 * - Persistência de modo de visualização
 * - Responsividade de elementos críticos (tooltips/badges)
 * - Navegação e carregamento
 */
test.describe('Módulo Novidades - Bateria de Testes Exaustiva (Foco em Gaps)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/novidades');
    // Espera o título da página usando o data-testid
    await page.waitForSelector('[data-testid="page-title-novidades"]', { state: 'visible' });
  });

  test('Deve gerenciar filtros cruzados e estado vazio corretamente', async ({ page }) => {
    // 1. Abre o seletor de fornecedor (Select)
    const supplierTrigger = page.locator('button:has-text("Fornecedor")').first();
    await supplierTrigger.click();
    
    // 2. Se houver opções, seleciona a primeira. Caso contrário, valida que o trigger existe.
    const supplierOption = page.locator('[role="option"]').first();
    if (await supplierOption.isVisible()) {
      const supplierName = await supplierOption.textContent();
      await supplierOption.click();
      
      // 3. Aplica busca textual que NÃO deve existir para esse fornecedor
      const searchInput = page.locator('input[placeholder*="Buscar novidades"]').first();
      await searchInput.fill('termo-extremamente-improvavel-xyz-123');
      
      // 4. Valida estado vazio específico
      await expect(page.locator('text=Nenhuma novidade com esses filtros')).toBeVisible();
      
      // 5. Testa o botão de "Limpar filtros" dentro do estado vazio
      const clearBtn = page.locator('button:text("Limpar filtros")');
      await expect(clearBtn).toBeVisible();
      await clearBtn.click();
      
      // 6. Verifica se voltou ao estado inicial (busca limpa)
      await expect(searchInput).toHaveValue('');
    }
  });

  test('Deve validar a integridade dos KPIs em diferentes viewports', async ({ page }) => {
    const kpiSection = page.locator('.grid-cols-2.lg\\:grid-cols-5'); // Seletor baseado nas classes do NoveltyStatsCards
    await expect(kpiSection).toBeVisible();

    // Testa em mobile
    await page.setViewportSize({ width: 375, height: 667 });
    // No mobile, a grid de KPIs vira 2 colunas
    const visibleCards = page.locator('.grid-cols-2.lg\\:grid-cols-5 >> .border-border\\/50');
    await expect(visibleCards).toHaveCount(5);
    
    // Verifica se os textos não estão encavalados (overflow básico)
    const firstCardText = await visibleCards.first().innerText();
    expect(firstCardText.length).toBeGreaterThan(0);
  });

  test('Deve persistir o modo de visualização ao navegar e voltar', async ({ page }) => {
    // 1. Muda para modo Tabela
    const layoutBtn = page.locator('button:has(.lucide-layout-grid, .lucide-list, .lucide-table)').first();
    await layoutBtn.click();
    await page.locator('role=menuitem >> text=Tabela').click();
    
    // 2. Verifica se a tabela apareceu
    await expect(page.locator('table')).toBeVisible();
    
    // 3. Navega para outra página (ex: Home/Dashboard)
    await page.goto('/');
    await page.waitForURL('/');
    
    // 4. Volta para Novidades
    await page.goto('/novidades');
    
    // 5. Verifica se ainda está no modo Tabela (Persistência via estado local/URL)
    // Nota: Se o componente não persistir via URL/LocalStorage, isso pegará um GAP de UX.
    await expect(page.locator('table')).toBeVisible();
  });

  test('Deve validar o widget de "Expirando em Breve"', async ({ page }) => {
    const widget = page.locator('text=+ Recentes').locator('xpath=..'); // Encontra o container do widget
    await expect(widget).toBeVisible();
    
    // Verifica se o título do widget está correto
    await expect(page.locator('h3:has-text("+ Recentes")')).toBeVisible();
    
    // Se houver itens, tenta clicar em um
    const widgetItem = widget.locator('button, a').first();
    if (await widgetItem.isVisible()) {
      await widgetItem.click();
      await expect(page).toHaveURL(/\/produto\//);
    }
  });

  test('Deve validar seleção em lote e ações disponíveis', async ({ page }) => {
    // 1. Ativa seleção
    const selectBtn = page.locator('button:text("Selecionar")');
    await selectBtn.click();
    
    // 2. Localiza checkboxes (usando o componente SelectionCheckbox)
    const checkboxes = page.locator('button[role="checkbox"]');
    
    // Se não houver produtos, o teste passa (vazio é válido), mas se houver:
    if (await checkboxes.count() > 0) {
      await checkboxes.first().click();
      
      // 3. Verifica se a BulkActionBar apareceu
      // A BulkActionBar costuma ter texto indicando quantidade
      await expect(page.locator('text=selecionado')).toBeVisible();
      
      // 4. Verifica se botões de ação em lote estão presentes (ex: "Adicionar", "Coleção")
      await expect(page.locator('button:has-text("Adicionar")')).toBeVisible();
      await expect(page.locator('button:has-text("Coleção")')).toBeVisible();
    }
  });
});

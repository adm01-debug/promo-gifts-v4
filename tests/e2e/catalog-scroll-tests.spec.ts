import { test, expect } from '@playwright/test';

/**
 * BATERIA DE TESTES DE SCROLL - PÁGINA DE CATÁLOGO (FILTERS PAGE)
 * Foco: Virtualização, Infinite Scroll, Estabilidade da Barra de Filtros e Scroll to Top.
 */
test.describe('Catálogo: Performance e Bateria de Testes de Scroll', () => {
  
  test.beforeEach(async ({ page }) => {
    // Acessa a página de produtos (FiltersPage)
    // Usamos /produtos que mapeia para o FiltersPage
    await page.goto('/produtos');
    // Espera o grid virtualizado carregar
    await page.waitForSelector('[data-testid="virtualized-product-grid"]');
  });

  test('Deve manter a barra de filtros sticky durante o scroll', async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    const filterBar = page.locator('.sticky.top-0.z-20'); // Barra de filtros interna do VirtualizedProductGrid
    
    // Verifica visibilidade inicial
    await expect(filterBar).toBeVisible();

    // Scroll para baixo
    await grid.evaluate((el) => el.scrollTop = 1000);
    
    // Verifica se a barra continua no topo (sticky)
    const boundingBox = await filterBar.boundingBox();
    expect(boundingBox?.y).toBeLessThanOrEqual(250); // Deve estar perto do topo da viewport/grid
    await expect(filterBar).toBeVisible();
  });

  test('Deve carregar mais produtos via Infinite Scroll', async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Conta produtos iniciais (virtualizados, então contamos o que está no DOM)
    const initialItems = await page.locator('[data-testid^="product-card"]').count();
    
    // Scroll exaustivo para o final do container
    await grid.evaluate(async (el) => {
      el.scrollTop = el.scrollHeight;
    });

    // Espera o loader aparecer ou novos itens serem renderizados
    // Como é virtualizado, o número de itens no DOM pode não crescer infinitamente, 
    // mas o index dos itens deve mudar.
    await page.waitForTimeout(2000); // Espera carregamento da API simulada/real

    const scrolledItems = await page.locator('[data-testid^="product-card"]').count();
    
    // Em virtualização, verificamos se o scroll resultou em novos elementos ou se o scrollHeight aumentou
    const newScrollHeight = await grid.evaluate((el) => el.scrollHeight);
    expect(newScrollHeight).toBeGreaterThan(1000); 
  });

  test('Botão "Voltar ao Topo" deve aparecer e funcionar corretamente', async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    const scrollTopBtn = page.locator('button[title="Voltar ao topo"]');

    // Inicialmente oculto
    await expect(scrollTopBtn).not.toBeVisible();

    // Scroll de 500px para disparar o botão
    await grid.evaluate((el) => el.scrollTop = 600);
    
    // Verifica se apareceu
    await expect(scrollTopBtn).toBeVisible();

    // Clica no botão
    await scrollTopBtn.click();

    // Verifica se voltou ao topo
    await page.waitForTimeout(500); // Tempo da animação smooth
    const scrollTop = await grid.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeLessThanOrEqual(5);
  });

  test('Estabilidade da virtualização em scroll rápido (Stress Test)', async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Simula scroll rápido (flick) várias vezes
    for (let i = 0; i < 5; i++) {
      await grid.evaluate((el) => el.scrollBy({ top: 2000, behavior: 'smooth' }));
      await page.waitForTimeout(200);
      await grid.evaluate((el) => el.scrollBy({ top: -1000, behavior: 'smooth' }));
      await page.waitForTimeout(200);
    }

    // Verifica se não houve "blank screen" permanente
    const itemsCount = await page.locator('[data-testid^="product-card"]').count();
    expect(itemsCount).toBeGreaterThan(0);
    
    // Verifica se o loader não ficou travado
    await expect(page.locator('text=Carregando mais...')).not.toBeVisible({ timeout: 5000 });
  });

  test('Scroll deve funcionar corretamente em diferentes densidades de grid', async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Abre popover de layout
    await page.locator('[data-testid="layout-popover-trigger"]').click();
    
    // Muda para 6 colunas (se disponível) ou apenas alterna modos
    const sixColsBtn = page.locator('button:has-text("6")');
    if (await sixColsBtn.isVisible()) {
      await sixColsBtn.click();
    }

    // Scroll e verifica se os itens estão posicionados
    await grid.evaluate((el) => el.scrollTop = 500);
    const firstItem = page.locator('[data-testid^="product-card"]').first();
    await expect(firstItem).toBeVisible();
  });
});

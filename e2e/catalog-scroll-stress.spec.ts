/**
 * BATERIA DE TESTES DE SCROLL - PÁGINA DE CATÁLOGO (FILTERS PAGE)
 * Foco: Virtualização, Infinite Scroll, Estabilidade da Barra de Filtros e Scroll to Top.
 */
import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";

test.describe('Catálogo: Performance e Bateria de Testes de Scroll', () => {
  
  test.beforeEach(async ({ page }) => {
    // Acessa a página de produtos (FiltersPage)
    await gotoAndSettle(page, '/produtos');
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
    // A barra sticky deve estar visível e perto do topo do container
    expect(boundingBox?.y).toBeLessThanOrEqual(300); 
    await expect(filterBar).toBeVisible();
  });

  test('Deve carregar mais produtos via Infinite Scroll (Virtualizado)', async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Conta produtos iniciais
    const initialItemsCount = await page.locator('[data-testid^="product-card"]').count();
    
    // Pega o scrollHeight inicial
    const initialScrollHeight = await grid.evaluate((el) => el.scrollHeight);

    // Scroll exaustivo para o final do container para disparar o onLoadMore
    await grid.evaluate(async (el) => {
      el.scrollTop = el.scrollHeight;
    });

    // Espera o carregamento (loader ou aumento de scrollHeight)
    await page.waitForTimeout(2000); 

    // Em virtualização, o scrollHeight deve aumentar se mais itens forem adicionados ao virtualizer
    const newScrollHeight = await grid.evaluate((el) => el.scrollHeight);
    expect(newScrollHeight).toBeGreaterThan(initialScrollHeight); 
  });

  test('Botão "Voltar ao Topo" deve aparecer e funcionar corretamente', async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    const scrollTopBtn = page.locator('button[title="Voltar ao topo"]');

    // Inicialmente oculto
    await expect(scrollTopBtn).not.toBeVisible();

    // Scroll de 600px para disparar o botão (limiar no código é 300px)
    await grid.evaluate((el) => el.scrollTop = 600);
    
    // Verifica se apareceu
    await expect(scrollTopBtn).toBeVisible();

    // Clica no botão
    await scrollTopBtn.click();

    // Verifica se voltou ao topo
    await page.waitForTimeout(800); // Tempo da animação smooth
    const scrollTop = await grid.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeLessThanOrEqual(10);
  });

  test('Estabilidade da virtualização em scroll rápido (Stress Test)', async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Simula scroll rápido várias vezes para testar resiliência do virtualizer
    for (let i = 0; i < 4; i++) {
      await grid.evaluate((el) => el.scrollBy({ top: 1500, behavior: 'auto' }));
      await page.waitForTimeout(100);
      await grid.evaluate((el) => el.scrollBy({ top: -500, behavior: 'auto' }));
      await page.waitForTimeout(100);
    }

    // Verifica se não houve "blank screen" permanente
    const itemsCount = await page.locator('[data-testid^="product-card"]').count();
    expect(itemsCount).toBeGreaterThan(0);
  });

  test('Scroll deve resetar ao topo ao mudar ordenação ou filtros', async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Scroll para baixo
    await grid.evaluate((el) => el.scrollTop = 1500);
    
    // Muda ordenação
    const sortTrigger = page.locator('[data-testid="catalog-sort-trigger"]');
    await sortTrigger.click();
    await page.locator('[data-testid="catalog-sort-item-price-asc"]').first().click();
    
    // Verifica se voltou ao topo automaticamente
    await page.waitForTimeout(500);
    const scrollTop = await grid.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeLessThanOrEqual(5);
  });
});

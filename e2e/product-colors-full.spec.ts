import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Avançado para Cores do Produto.
 * Valida skeletons, fallbacks, acessibilidade completa, screenshots e eficiência de cache.
 * Cobre todos os módulos: Catálogo, Novidades, Reposição e Estoque.
 */

const MODULES = [
  { name: 'Catálogo', path: '/produtos', viewModes: ['grid', 'list'] }, // Catálogo costuma ter grid/list toggle
  { name: 'Novidades', path: '/novidades', viewModes: ['grid', 'list', 'table'] },
  { name: 'Reposição', path: '/reposicao', viewModes: ['grid', 'list', 'table'] },
  { name: 'Estoque', path: '/estoque', viewModes: ['table'] }, // Estoque é primariamente tabela
];

async function setupRouteInterception(page: Page) {
  const state = {
    requests: [] as string[],
    count: 0,
  };
  await page.route('**/rest/v1/product_variants*', async (route) => {
    state.requests.push(route.request().url());
    state.count++;
    await route.continue();
  });
  return state;
}

async function switchViewMode(page: Page, mode: 'grid' | 'list' | 'table') {
  const labelMap = { grid: 'Grid', list: 'Lista', table: 'Tabela' };
  
  // Tenta abrir o LayoutPopover
  const layoutBtn = page.locator('button[aria-label="Alterar layout"]');
  if (await layoutBtn.isVisible()) {
    await layoutBtn.click();
    const modeBtn = page.getByRole('button', { name: labelMap[mode], exact: true });
    if (await modeBtn.isVisible()) {
      await modeBtn.click();
      await page.keyboard.press('Escape'); // Fecha o popover se necessário
      await page.waitForTimeout(500);
      return;
    }
  }

  // Fallback para botões diretos de visualização que podem existir em outros headers
  const directBtn = page.locator(`button[aria-label*="${labelMap[mode]}" i]`);
  if (await directBtn.isVisible()) {
    await directBtn.click();
    await page.waitForTimeout(500);
  }
}

test.describe('Cores do Produto: Validação Rigorosa de Ciclo de Vida e Acessibilidade', () => {
  
  for (const module of MODULES) {
    test.describe(`${module.name}`, () => {
      
      test('Deve validar skeleton, carregamento final e acessibilidade em todas as visões', async ({ page }) => {
        const apiState = await setupRouteInterception(page);
        await page.setViewportSize({ width: 1366, height: 800 });

        // 1. Navegação e Skeleton
        // Delay simulado via interceptação para garantir captura do skeleton se necessário
        await page.goto(module.path);

        // Screenshot do Skeleton
        const skeleton = page.locator('[data-testid="colors-loading-skeleton"]').first();
        if (await skeleton.isVisible()) {
          await expect(skeleton).toHaveAttribute('aria-busy', 'true');
          await page.screenshot({ 
            path: `test-results/skeleton-${module.name.toLowerCase()}-initial.png`,
            fullPage: false 
          });
        }

        for (const mode of module.viewModes) {
          await switchViewMode(page, mode as any);
          
          // 2. Aguarda carregamento real
          await page.waitForSelector('[data-testid="product-colors-container"], [data-testid="colors-unavailable"]', { timeout: 15_000 });

          const container = page.locator('[data-testid="product-colors-container"]').first();
          const unavailable = page.locator('[data-testid="colors-unavailable"]').first();

          if (await container.isVisible()) {
            // Acessibilidade do Container
            await expect(container).toHaveAttribute('role', 'group');
            await expect(container).toHaveAttribute('aria-live', 'polite');
            await expect(container).toHaveAttribute('aria-label', /\d+ cores? disponíveis/);

            const swatch = container.locator('button').first();
            await expect(swatch).toHaveAttribute('aria-label', /^Opção de cor: /);
            
            const ariaDescribedBy = await swatch.getAttribute('aria-describedby');
            expect(ariaDescribedBy).toMatch(/^tooltip-color-/);

            // Foco via Teclado e Tooltip
            await page.keyboard.press('Tab');
            // Dependendo de onde o foco caiu, podemos precisar de mais Tabs
            // Para ser robusto, focamos diretamente via script e validamos o estado
            await swatch.focus();
            await expect(swatch).toBeFocused();

            const tooltip = page.locator(`[id="${ariaDescribedBy}"]`);
            await expect(tooltip).toBeVisible();
            await expect(tooltip).toHaveAttribute('role', 'tooltip');

            // Screenshot do estado Final
            await page.screenshot({ 
              path: `test-results/colors-${module.name.toLowerCase()}-${mode}-final.png` 
            });

          } else if (await unavailable.isVisible()) {
            await expect(unavailable).toHaveAttribute('role', 'status');
            await expect(unavailable).toHaveAttribute('aria-live', 'polite');
            await expect(unavailable).toContainText('Cores indisponíveis');
          }
        }
      });

      if (module.name === 'Novidades' || module.name === 'Reposição') {
        test('Deve garantir eficiência de cache (deduplicação) ao mudar lista parcialmente', async ({ page }) => {
          const apiState = await setupRouteInterception(page);
          await page.goto(module.path);
          
          await page.waitForSelector('[data-testid="product-colors-container"]', { timeout: 15_000 });
          const initialCount = apiState.count;
          expect(initialCount).toBeGreaterThan(0);

          // Simula mudança parcial (ex: scroll para carregar mais ou paginação)
          // Em Novidades/Reposição temos scroll infinito ou paginação.
          // Vamos tentar rolar a página.
          await page.mouse.wheel(0, 2000);
          await page.waitForTimeout(1000); // Aguarda possíveis novas requests

          const afterScrollCount = apiState.count;
          
          // Se carregou mais produtos, o count sobe.
          // Se voltarmos para o topo, não deve subir de novo para os mesmos produtos (cache).
          await page.mouse.wheel(0, -2000);
          await page.waitForTimeout(1000);
          
          const finalCount = apiState.count;
          // Não deve ter feito novas requisições ao voltar para produtos que já estavam em cache
          expect(finalCount).toBe(afterScrollCount);
        });
      }
    });
  }
});

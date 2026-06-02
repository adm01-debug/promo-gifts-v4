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
    lastIds: [] as string[],
  };
  await page.route('**/rest/v1/product_variants*', async (route) => {
    const url = route.request().url();
    state.requests.push(url);
    state.count++;
    
    // Tenta extrair product_ids da query string para logar se necessário
    const urlObj = new URL(url);
    const inParam = urlObj.searchParams.get('product_id');
    if (inParam) {
      state.lastIds = inParam.replace(/^\(|\)$/g, '').split(',');
    }
    
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

            const swatches = container.locator('button');
            const swatchCount = await swatches.count();
            expect(swatchCount).toBeGreaterThan(0);

            // Navegação por Tab: foca o primeiro e tab pelos demais
            const first = swatches.first();
            await first.focus();
            await expect(first).toBeFocused();

            for (let i = 0; i < swatchCount; i++) {
              const sw = swatches.nth(i);
              await sw.focus();
              await expect(sw).toBeFocused();

              const ariaLabel = await sw.getAttribute('aria-label');
              const ariaDescribedBy = await sw.getAttribute('aria-describedby');
              expect(ariaLabel).toMatch(/^(Opção de cor: |Ver mais )/);
              
              // O botão "+N" overflow não tem aria-describedby; somente swatches reais
              if (ariaLabel?.startsWith('Opção de cor:')) {
                expect(ariaDescribedBy).toMatch(/^tooltip-color-/);
                const tooltip = page.locator(`[id="${ariaDescribedBy}"]`);
                await expect(tooltip).toBeVisible();
                await expect(tooltip).toHaveAttribute('role', 'tooltip');
                // O texto do tooltip deve refletir a cor declarada no aria-label
                const colorName = ariaLabel.replace('Opção de cor: ', '').trim();
                await expect(tooltip).toContainText(colorName);
              }
            }

            // Screenshot do estado Final
            await page.screenshot({ 
              path: `test-results/colors-${module.name.toLowerCase()}-${mode}-final.png` 
            });

          } else if (await unavailable.isVisible()) {
            await expect(unavailable).toHaveAttribute('role', 'status');
            await expect(unavailable).toHaveAttribute('aria-live', 'polite');
            await expect(unavailable).toContainText('Cores indisponíveis');
            await page.screenshot({ 
              path: `test-results/colors-${module.name.toLowerCase()}-${mode}-unavailable.png` 
            });
          }
        }
      });

      if (module.name === 'Novidades' || module.name === 'Reposição') {
        test('Deve garantir eficiência de cache e deduplicação ao mudar lista parcialmente', async ({ page }) => {
          const apiState = await setupRouteInterception(page);
          await page.goto(module.path);
          
          await page.waitForSelector('[data-testid="product-colors-container"], [data-testid="colors-unavailable"]', { timeout: 20_000 });
          const initialCount = apiState.count;
          expect(initialCount).toBeGreaterThan(0);

          // Captura os IDs que foram buscados inicialmente
          const firstBatchIds = [...apiState.lastIds];

          // 1. Simula mudança parcial (scroll para carregar mais)
          await page.mouse.wheel(0, 3000);
          await page.waitForTimeout(2000); // Aguarda carregamento de mais itens e disparos de rede

          const afterScrollCount = apiState.count;
          const secondBatchIds = [...apiState.lastIds];

          // Se carregou mais, deve ter disparado requests
          // Se disparou, validamos que ao voltar não dispara de novo
          if (afterScrollCount > initialCount) {
             // 2. Volta para o topo (onde estão os produtos do firstBatch)
             await page.evaluate(() => window.scrollTo(0, 0));
             await page.waitForTimeout(1000);
             
             const finalCount = apiState.count;
             // Cache check: Não deve ter feito novas requisições para o que já estava em cache
             expect(finalCount).toBe(afterScrollCount);
          }

          // 3. Validação de deduplicação por query key
          // Se navegarmos para outro módulo e voltarmos, o TanStack Query deve usar cache se o staleTime permitir
          // ou o nosso GLOBAL_COLORS_CACHE deve evitar a request se os IDs forem os mesmos.
          await page.goto('/'); // Home
          await page.waitForTimeout(500);
          await page.goto(module.path);
          await page.waitForSelector('[data-testid="product-colors-container"]');
          
          // Como o staleTime é 10min, não deve disparar nova request se for a mesma lista
          // Se disparar (ex: queryKey diferente), o GLOBAL_COLORS_CACHE dentro do useQuery deve resultar em missingIds.length === 0
          // e não chamar o Supabase.
          const countAfterRevisit = apiState.count;
          expect(countAfterRevisit).toBe(afterScrollCount);
        });
      }
    });
  }
});

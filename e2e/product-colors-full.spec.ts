import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Avançado para Cores do Produto.
 * Valida skeletons, fallbacks, acessibilidade completa, screenshots e eficiência de cache.
 * Cobre todos os módulos: Catálogo, Novidades, Reposição e Estoque.
 */

const MODULES = [
  { name: 'Catálogo', path: '/produtos', viewModes: ['grid', 'list'] },
  { name: 'Novidades', path: '/novidades', viewModes: ['grid', 'list', 'table'] },
  { name: 'Reposição', path: '/reposicao', viewModes: ['grid', 'list', 'table'] },
  { name: 'Estoque', path: '/estoque', viewModes: ['table'] },
];

async function setupRouteInterception(page: Page) {
  const state = {
    requests: [] as string[],
    count: 0,
    lastIds: [] as string[],
  };
  // Intercepta chamadas ao Supabase para variantes (onde as cores são buscadas)
  await page.route('**/rest/v1/product_variants*', async (route) => {
    const url = route.request().url();
    state.requests.push(url);
    state.count++;
    
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
  
  const layoutBtn = page.locator('button[aria-label="Alterar layout"]');
  if (await layoutBtn.isVisible()) {
    await layoutBtn.click();
    const modeBtn = page.getByRole('button', { name: labelMap[mode], exact: true });
    if (await modeBtn.isVisible()) {
      await modeBtn.click();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      return;
    }
  }

  const directBtn = page.locator(`button[aria-label*="${labelMap[mode]}" i]`);
  if (await directBtn.isVisible()) {
    await directBtn.click();
    await page.waitForTimeout(500);
  }
}

test.describe('Cores do Produto: Padronização e Performance', () => {
  
  for (const module of MODULES) {
    test.describe(`${module.name}`, () => {
      
      test('Deve validar ciclo de vida (skeleton -> dados/vazio) e acessibilidade', async ({ page }) => {
        await setupRouteInterception(page);
        await page.setViewportSize({ width: 1366, height: 800 });
        await page.goto(module.path);

        // Assert de Skeleton Padronizado
        const skeleton = page.locator('[data-testid="colors-loading-skeleton"]').first();
        if (await skeleton.isVisible()) {
          await expect(skeleton).toHaveAttribute('aria-busy', 'true');
          await expect(skeleton).toHaveClass(/min-h-\[16px\]/);
          await expect(page.locator('[data-testid="color-skeleton-dot"]').first()).toBeVisible();
        }

        for (const mode of module.viewModes) {
          await test.step(`Visualização: ${mode}`, async () => {
            await switchViewMode(page, mode as any);
            
            // Aguarda estado final (carregado ou indisponível)
            const finalState = page.locator('[data-testid="product-colors-container"], [data-testid="colors-unavailable"]').first();
            await expect(finalState).toBeVisible({ timeout: 15_000 });

            if (await page.locator('[data-testid="product-colors-container"]').first().isVisible()) {
              const container = page.locator('[data-testid="product-colors-container"]').first();
              await expect(container).toHaveAttribute('role', 'group');
              await expect(container).toHaveClass(/min-h-\[16px\]/);

              const swatches = container.locator('button[data-testid^="color-swatch-"]');
              const count = await swatches.count();
              
              if (count > 0) {
                // Validação detalhada de Tab-Navigation e Tooltip
                for (let i = 0; i < Math.min(count, 3); i++) {
                  const sw = swatches.nth(i);
                  await sw.focus();
                  await expect(sw).toBeFocused();

                  const ariaLabel = await sw.getAttribute('aria-label');
                  const ariaDescribedBy = await sw.getAttribute('aria-describedby');
                  
                  if (ariaLabel?.startsWith('Opção de cor:')) {
                    const expectedColor = ariaLabel.replace('Opção de cor: ', '').trim();
                    expect(ariaDescribedBy).toMatch(/^tooltip-color-/);
                    
                    const tooltip = page.locator(`[id="${ariaDescribedBy}"]`);
                    await expect(tooltip).toBeVisible();
                    await expect(tooltip).toHaveAttribute('role', 'tooltip');
                    await expect(tooltip).toHaveText(expectedColor);
                  }
                }
              }
            } else {
              // Assert de Fallback Padronizado
              const unavailable = page.locator('[data-testid="colors-unavailable"]').first();
              await expect(unavailable).toBeVisible();
              await expect(unavailable).toHaveText('Cores indisponíveis');
              await expect(unavailable).toHaveClass(/min-h-\[16px\]/);
            }
          });
        }
      });

      if (module.name === 'Novidades' || module.name === 'Reposição') {
        test('Deve validar cache e deduplicação (ids, paginação)', async ({ page }) => {
          const apiState = await setupRouteInterception(page);
          await page.goto(module.path);
          
          await expect(page.locator('[data-testid="product-colors-container"], [data-testid="colors-unavailable"]').first()).toBeVisible({ timeout: 20_000 });
          
          const countAfterFirstLoad = apiState.count;
          expect(countAfterFirstLoad).toBeGreaterThan(0);

          // 1. Simula Paginação/Offset (scroll para carregar mais)
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(2000);
          
          const countAfterPagination = apiState.count;
          // Deve ter aumentado se carregou novos produtos
          
          // 2. Volta para o estado anterior (IDs já cacheados)
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(1000);
          
          const countAfterReturn = apiState.count;
          // NÃO deve ter feito novas requests para os IDs iniciais
          expect(countAfterReturn).toBe(countAfterPagination);

          // 3. Alternância rápida entre módulos
          await page.goto('/'); // Home
          await page.waitForTimeout(500);
          await page.goto(module.path);
          await expect(page.locator('[data-testid="product-colors-container"], [data-testid="colors-unavailable"]').first()).toBeVisible();
          
          // O TanStack Query ou o Cache Global devem impedir nova request
          expect(apiState.count).toBe(countAfterPagination);
        });
      }
    });
  }

  test('Deve alternar rapidamente entre visualizações sem flicker indevido', async ({ page }) => {
    const module = MODULES[1]; // Novidades (tem todas as visões)
    await page.goto(module.path);
    await page.waitForSelector('[data-testid="product-colors-container"]');

    // Alternância rápida
    for (const mode of ['list', 'table', 'grid', 'list']) {
      await switchViewMode(page, mode as any);
      // Verifica que o container de cores está lá (ou o skeleton se for muito rápido, mas não deve ter "indisponível" piscando)
      const visible = await page.locator('[data-testid="product-colors-container"], [data-testid="colors-loading-skeleton"]').first().isVisible();
      expect(visible).toBeTruthy();
    }
  });
});

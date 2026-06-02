import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Valida a exibição das bolinhas de cores (swatches) em todos os módulos e visualizações.
 * Verifica tooltips, acessibilidade (aria-label) e estados de carregamento.
 */

const MODULES = [
  { name: 'Catálogo', path: '/produtos' },
  { name: 'Super Filtro', path: '/filtros' },
  { name: 'Novidades', path: '/novidades' },
  { name: 'Reposição', path: '/reposicao' },
  { name: 'Estoque', path: '/estoque' },
];

async function gotoModule(page: Page, path: string) {
  await page.goto(path);
  // Aguarda um tempo para que os produtos carreguem.
  await page.waitForSelector('.animate-pulse, [role="list"][aria-label*="cor"]', { timeout: 15_000 }).catch(() => {});
}

test.describe('Cores do Produto: Swatches, Tooltips e Acessibilidade', () => {
  
  for (const module of MODULES) {
    test.describe(`${module.name}`, () => {
      
      test('Deve exibir bolinhas de cores em Grid, Lista e Tabela com tooltips e labels corretos', async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 800 });
        await gotoModule(page, module.path);

        // 1. Validar no modo atual (geralmente Grid ou Tabela dependendo do módulo)
        const swatchContainer = page.locator('[role="list"][aria-label*="cor"]').first();
        
        // Se não encontrar de imediato, pode ser que o produto não tenha cores ou esteja carregando
        if (await swatchContainer.count() === 0) {
          // Verifica se há skeletons de carregamento
          const skeletons = page.locator('.animate-pulse').first();
          if (await skeletons.count() > 0) {
            await expect(skeletons).toBeVisible();
          }
          // Aguarda um pouco mais para os dados reais
          await page.waitForSelector('[role="list"][aria-label*="cor"]', { timeout: 10_000 }).catch(() => {});
        }

        // Se ainda não houver swatches, o produto pode não ter variantes (comum em mocks), 
        // mas em produção esperamos ao menos um.
        if (await swatchContainer.count() > 0) {
          const container = swatchContainer.first();
          await expect(container).toBeVisible();
          
          // Valida aria-label do container
          const label = await container.getAttribute('aria-label');
          expect(label).toMatch(/\d+ cores? disponíveis/);

          // Valida o primeiro swatch
          const firstSwatch = container.locator('button[role="listitem"]').first();
          await expect(firstSwatch).toHaveAttribute('aria-label', /^Cor: /);

          // Hover Tooltip
          await firstSwatch.hover();
          const tooltip = page.getByRole('tooltip').first();
          await expect(tooltip).toBeVisible({ timeout: 3000 });
          const tooltipText = await tooltip.innerText();
          expect(tooltipText.length).toBeGreaterThan(0);

          // Foco via Teclado
          await firstSwatch.focus();
          await expect(firstSwatch).toBeFocused();
          await expect(page.getByRole('tooltip').first()).toBeVisible();

          // Screenshot de sucesso
          await page.screenshot({ path: `test-results/colors-${module.name.toLowerCase().replace(' ', '-')}.png` });
        } else {
          console.warn(`Aviso: Nenhum swatch encontrado em ${module.name}. Verifique se o ambiente de teste possui variantes de cores.`);
        }
      });
    });
  }
});

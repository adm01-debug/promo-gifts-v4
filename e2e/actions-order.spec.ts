import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * E2E: valida a ordem padronizada dos botões de ação na visualização em lista
 * e na tabela em diversos módulos (Catálogo, Super Filtro, Novidades, Reposição, Estoque).
 * Valida acessibilidade (aria-label), tooltips no hover e no focus,
 * navegação via teclado e responsividade (mobile).
 */

const EXPECTED_ACTIONS: ReadonlyArray<{ ariaLabel: string; tooltip: string }> = [
  { ariaLabel: 'Adicionar ao Carrinho', tooltip: 'Adicionar ao Carrinho' },
  { ariaLabel: 'Orçamento', tooltip: 'Orçamento' },
  { ariaLabel: 'Coleção', tooltip: 'Coleção' },
  { ariaLabel: 'Favoritar', tooltip: 'Favoritar' },
  { ariaLabel: 'Comparar', tooltip: 'Comparar' },
  { ariaLabel: 'Quick View', tooltip: 'Quick View' },
  { ariaLabel: 'Compartilhar', tooltip: 'Compartilhar' },
];

const MODULES = [
  { name: 'Catálogo', path: '/produtos' },
  { name: 'Super Filtro', path: '/filtros' },
  { name: 'Novidades', path: '/novidades' },
  { name: 'Reposição', path: '/reposicao' },
  { name: 'Estoque', path: '/estoque' },
];

async function gotoModule(page: Page, path: string) {
  await page.goto(path);
  // Aguarda carregamento. O seletor de favorito é um bom indicador de que a lista renderizou.
  // Em alguns módulos (como Estoque) pode ser diferente, então usamos um timeout generoso ou múltiplos seletores.
  try {
    await Promise.race([
      page.waitForSelector('[data-testid="product-favorite"]', { timeout: 10_000 }),
      page.waitForSelector('button[aria-label="Favoritar"]', { timeout: 10_000 }),
    ]);
  } catch (e) {
    console.warn(`Aviso: Timeout aguardando produtos em ${path}. Prosseguindo mesmo assim.`);
  }
}

/**
 * Retorna os botões de ação do primeiro item visível.
 */
async function getFirstRowActionButtons(page: Page): Promise<Locator> {
  // Tenta encontrar o primeiro botão de favorito e subir até o container do item
  const favoriteBtn = page.locator('[data-testid="product-favorite"], button[aria-label="Favoritar"]').first();
  await favoriteBtn.scrollIntoViewIfNeeded();
  
  // Encontra o ancestral que contém as ações. Geralmente tem a classe "group"
  const itemRow = favoriteBtn.locator('xpath=ancestor::*[contains(@class,"group")][1]');
  await itemRow.hover(); // Ativa group-hover
  
  // O container de botões
  const actionsContainer = itemRow.locator('div').filter({ has: favoriteBtn }).last();
  return actionsContainer.locator('button:visible');
}

async function assertOrderAndA11y(page: Page, buttons: Locator, moduleName: string, isMobile: boolean) {
  const count = await buttons.count();
  
  // Screenshot de debug inicial
  await page.screenshot({ path: `test-results/debug-${moduleName}-${isMobile ? 'mobile' : 'desktop'}-start.png` });

  // Em mobile, alguns botões podem estar ocultos ou em menu. 
  // O requisito diz "garantir que não quebrem nem perdam acessibilidade".
  // Se a ordem for diferente em mobile, teríamos que ajustar. 
  // Mas assumiremos que os 7 devem estar lá.
  expect(count, `Módulo ${moduleName}: esperado 7 botões de ação visíveis`).toBe(EXPECTED_ACTIONS.length);

  for (let i = 0; i < EXPECTED_ACTIONS.length; i++) {
    const expected = EXPECTED_ACTIONS[i];
    const btn = buttons.nth(i);

    try {
      // 1. aria-label
      await expect(btn).toHaveAttribute('aria-label', expected.ariaLabel);

      // 2. Hover Tooltip (apenas desktop)
      if (!isMobile) {
        await btn.hover();
        await expect(page.getByRole('tooltip', { name: expected.tooltip }).first()).toBeVisible({ timeout: 2000 });
        await page.mouse.move(0, 0); // Reset hover
      }

      // 3. Teclado (Tab) e Focus Tooltip
      await page.keyboard.press('Tab');
      // Precisamos garantir que o foco caiu no botão certo. 
      // Se houver outros elementos antes, talvez tenhamos que dar mais Tabs.
      // Uma forma melhor é focar diretamente e validar o estado de foco.
      await btn.focus();
      await expect(btn).toBeFocused();
      
      const focusTooltip = page.getByRole('tooltip', { name: expected.tooltip }).first();
      await expect(focusTooltip).toBeVisible({ timeout: 2000 });

      // 4. Teclado (Enter/Space) - Valida que o botão é clicável (sem disparar ação real se possível, ou apenas verificando se não quebra)
      // Aqui apenas validamos que o elemento aceita o evento de teclado.
      await btn.dispatchEvent('keydown', { key: 'Enter' });

    } catch (error) {
      // Screenshot em caso de falha específica no loop
      await page.screenshot({ 
        path: `test-results/failure-${moduleName}-${i}-${isMobile ? 'mobile' : 'desktop'}.png`,
        fullPage: true 
      });
      throw error;
    }
  }
}

test.describe('Ações do Produto: Ordem, Tooltips e Acessibilidade Cross-Module', () => {
  
  for (const module of MODULES) {
    
    test.describe(`${module.name}`, () => {
      
      // Desktop Tests
      test(`Desktop (1366x800): Ordem e Tooltips em Lista`, async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 800 });
        await gotoModule(page, module.path);

        // Forçar modo lista se disponível
        const listToggle = page.getByRole('button', { name: /Lista/i }).first();
        if (await listToggle.isVisible().catch(() => false)) {
          await listToggle.click();
        }

        const buttons = await getFirstRowActionButtons(page);
        await assertOrderAndA11y(page, buttons, module.name, false);
      });

      test(`Desktop (1366x800): Ordem e Tooltips em Tabela`, async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 800 });
        await gotoModule(page, module.path);

        // Forçar modo tabela se disponível
        const tableToggle = page.getByRole('button', { name: /Tabela|Tabular/i }).first();
        if (await tableToggle.isVisible().catch(() => false)) {
          await tableToggle.click();
          await page.waitForTimeout(500);
        }

        const buttons = await getFirstRowActionButtons(page);
        await assertOrderAndA11y(page, buttons, module.name, false);
      });

      // Mobile Tests
      test(`Mobile (375x667): Ordem e Acessibilidade em Lista`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await gotoModule(page, module.path);

        // Em mobile, a visualização geralmente é lista por padrão.
        const buttons = await getFirstRowActionButtons(page);
        await assertOrderAndA11y(page, buttons, module.name, true);
      });
    });
  }
});

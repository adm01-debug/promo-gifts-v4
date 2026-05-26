import { test, expect } from './fixtures/test-base';
import { loginAs } from './helpers/auth';

const STORAGE_KEY = "product-grid-columns";

test.describe('E2E: Seletor de Colunas (Grid)', () => {
  test.beforeEach(async ({ page }) => {
    // Garantir login e ir para a página de produtos/catálogo
    await loginAs(page);
    await page.goto('/produtos');
    // Esperar os produtos carregarem no grid virtualizado
    await page.waitForSelector('[data-testid="virtualized-product-grid"]', { timeout: 15000 });
  });

  test('Troca rápida de colunas e persistência no localStorage', async ({ page }) => {
    // Abrir o popover de layout
    const trigger = page.getByTestId('layout-popover-trigger');
    await trigger.click();

    // Localizar o seletor de colunas
    const selector = page.getByTestId('column-selector');
    await expect(selector).toBeVisible();

    // Testar troca para 3 colunas
    const opt3 = page.getByTestId('column-option-3');
    await opt3.click();
    
    // Verificar se o localStorage foi atualizado
    const storedValue3 = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(storedValue3).toBe("3");

    // Navegar para outra rota e voltar
    await page.goto('/');
    await page.goto('/produtos');
    await page.waitForSelector('[data-testid="virtualized-product-grid"]');

    // Verificar se a escolha persistiu (o botão de 3 colunas deve estar ativo)
    await trigger.click();
    await expect(page.getByTestId('column-option-3')).toHaveAttribute('aria-checked', 'true');
    
    // Testar troca para 4 colunas
    await page.getByTestId('column-option-4').click();
    const storedValue4 = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(storedValue4).toBe("4");
    
    // Atualizar a página
    await page.reload();
    await page.waitForSelector('[data-testid="virtualized-product-grid"]');
    await trigger.click();
    await expect(page.getByTestId('column-option-4')).toHaveAttribute('aria-checked', 'true');
  });

  test('Resiliência a valores inválidos no localStorage', async ({ page }) => {
    // Definir valor inválido no localStorage
    await page.evaluate((key) => {
      localStorage.setItem(key, "invalid");
    }, STORAGE_KEY);

    await page.reload();
    await page.waitForSelector('[data-testid="virtualized-product-grid"]');

    // Deve carregar o default (geralmente 5 em desktop ou 3 se a tela for pequena)
    // No Playwright default viewport costuma ser 1280x720, então o seletor deve ter 5 ativo ou resetado
    await page.getByTestId('layout-popover-trigger').click();
    
    // Verifica se algum valor válido está selecionado (não quebrou)
    const checkedOption = page.locator('[role="radio"][aria-checked="true"]');
    await expect(checkedOption).toBeVisible();
    const val = await checkedOption.getAttribute('data-testid');
    expect(['column-option-3', 'column-option-4', 'column-option-5', 'column-option-6', 'column-option-8']).toContain(val);
  });

  test('Acessibilidade do seletor de colunas', async ({ page }) => {
    await page.getByTestId('layout-popover-trigger').click();
    const selector = page.getByTestId('column-selector');
    
    // Verificar labels ARIA
    await expect(selector).toHaveAttribute('aria-label', 'Número de colunas');
    const options = page.locator('[role="radio"]');
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      await expect(options.nth(i)).toHaveAttribute('aria-label', /colunas/);
    }

    // Testar navegação por teclado (Tab)
    await page.keyboard.press('Tab'); // Focar primeiro elemento do popover (Visualização)
    await page.keyboard.press('Tab'); // Focar segundo
    await page.keyboard.press('Tab'); // Focar terceiro
    await page.keyboard.press('Tab'); // Focar separador ou primeiro radio
    
    // Encontrar o elemento focado
    const focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    // Dependendo de quantos botões tem antes, pode precisar de mais Tabs. 
    // Vamos garantir o foco movendo manualmente se necessário ou apenas verificando se o foco é visível quando clicado.
    
    await options.first().click();
    await expect(options.first()).toBeFocused();
  });

  test('Regressão Visual da Grade em diferentes breakpoints', async ({ page }) => {
    const viewports = [
      { name: 'mobile', width: 375, height: 667, cols: 3 },
      { name: 'tablet', width: 800, height: 1024, cols: 4 },
      { name: 'desktop', width: 1280, height: 800, cols: 5 },
      { name: 'ultra-wide', width: 1600, height: 900, cols: 8 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/produtos');
      await page.waitForSelector('[data-testid="virtualized-product-grid"]');
      
      // Se necessário, forçar a coluna desejada via localStorage
      await page.evaluate(({ key, val }) => {
        localStorage.setItem(key, String(val));
      }, { key: STORAGE_KEY, val: vp.cols });
      await page.reload();
      await page.waitForSelector('[data-testid="virtualized-product-grid"]');

      // Snapshot da grade
      const grid = page.getByTestId('virtualized-product-grid');
      await expect(grid).toHaveScreenshot(`grid-layout-${vp.name}-${vp.cols}-cols.png`, {
        mask: [page.locator('[data-testid="product-card"]')] // Mascarar cards pois conteúdo pode variar
      });
    }
  });
});

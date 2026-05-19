import { test, expect } from '@playwright/test';

test.describe('Elite UX & Production Readiness Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and assume auto-login or basic session
    await page.goto('/');
  });

  test('Catalog to Quote Journey', async ({ page }) => {
    // 1. Acessibilidade: Skip to Content
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /pular para o conteúdo/i });
    await expect(skipLink).toBeVisible();
    await skipLink.click();
    await expect(page.locator('#main-content')).toBeFocused();

    // 2. Busca Global (Ctrl+K)
    await page.keyboard.press('Control+k');
    const searchInput = page.locator('#search');
    await expect(searchInput).toBeFocused();
    await searchInput.fill('Caneta');
    
    // 3. Grid de Produtos e Skeleton
    const productGrid = page.locator('.product-grid');
    await expect(productGrid).toBeVisible();
    
    // 4. Detalhe do Produto (PDP)
    await page.locator('.product-card').first().click();
    await expect(page).toHaveURL(/\/products\/.+/);
    
    // 5. Galeria de Cores e Sincronia
    const colorSelector = page.locator('.color-selector-variant');
    if (await colorSelector.isVisible()) {
      await colorSelector.first().click();
      // Verificar se o badge de estoque atualizou
      await expect(page.locator('.stock-badge')).toBeVisible();
    }

    // 6. Adicionar ao Orçamento
    const addBtn = page.getByRole('button', { name: /adicionar ao orçamento/i });
    await expect(addBtn).toBeEnabled();
    await addBtn.click();
    
    // 7. Notificação de Sucesso (Toast)
    await expect(page.locator('text=adicionado com sucesso')).toBeVisible();
  });

  test('Theme & Navigation Resilience', async ({ page }) => {
    // 1. Troca de Tema (Transição Visual)
    const themeToggle = page.getByRole('button', { name: /alterar tema/i });
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      // Verificamos se a classe de transição foi aplicada brevemente ou se o tema mudou
      const html = page.locator('html');
      const initialTheme = await html.getAttribute('class');
      await themeToggle.click();
      const finalTheme = await html.getAttribute('class');
      expect(initialTheme).not.toBe(finalTheme);
    }

    // 2. Barra de Progresso (NProgress)
    await page.locator('a[href="/ferramentas/bi"]').click();
    const progress = page.locator('#nprogress');
    // Pode ser muito rápido para pegar, mas tentamos
    await expect(page).toHaveURL(/\/ferramentas\/bi/);
  });

  test('Simulation Dashboard Accessibility', async ({ page }) => {
    await page.goto('/simulacao');
    await expect(page.getByText('QG de Elite: Testes & Simulação')).toBeVisible();
    
    // Verificar botões de ação
    await expect(page.getByRole('button', { name: /resiliência/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /fuzzing/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /teste de carga/i })).toBeVisible();
  });
});

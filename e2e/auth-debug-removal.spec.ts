import { test, expect, devices } from '@playwright/test';

/**
 * Testes de regressão para garantir que o card técnico de debug
 * foi removido permanentemente da tela de login.
 */
test.describe('Remoção do Card de Debug na Tela de Login', () => {
  const DEBUG_SELECTORS = [
    'text=Conexão Supabase',
    'text=Project Ref',
    'text=URL Ativa (Client)',
    '.mt-8.border-white/5.bg-black/40.p-4', // Card específico
  ];

  test.beforeEach(async ({ page }) => {
    // Acessa a página de autenticação (rota pública)
    await page.goto('/auth');
  });

  test('deve garantir que o card de debug não está visível por padrão', async ({ page }) => {
    for (const selector of DEBUG_SELECTORS) {
      await expect(page.locator(selector)).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('não deve exibir o card de debug após recarregar a página', async ({ page }) => {
    await page.reload();
    await expect(page.locator('text=Conexão Supabase')).not.toBeVisible({ timeout: 5000 });
  });

  test('não deve exibir o card de debug mesmo em caso de falha de conexão', async ({ page }) => {
    await page.route('**/rest/v1/**', route => route.abort('failed'));
    await page.route('**/auth/v1/**', route => route.abort('failed'));
    await page.reload();
    await expect(page.locator('text=Conexão Supabase')).not.toBeVisible({ timeout: 5000 });
  });

  test('não deve exibir o card de debug após tentativa de login malsucedida', async ({ page }) => {
    await page.fill('input[type="email"]', 'login-invalido-e2e@exemplo.com');
    await page.fill('input[type="password"]', 'senha-incorreta-qualquer');
    const submitButton = page.locator('button', { hasText: /Entrar na Plataforma/i });
    if (await submitButton.isVisible()) await submitButton.click();
    await expect(page.locator('text=Conexão Supabase')).not.toBeVisible({ timeout: 5000 });
  });

  /**
   * MOBILE VIEWPORT TESTS
   */
  test.describe('Mobile Viewport', () => {
    test.use({ viewport: devices['iPhone 13'].viewport, isMobile: true, hasTouch: true });

    test('não deve exibir card de debug em mobile (iPhone 13)', async ({ page }) => {
      for (const selector of DEBUG_SELECTORS) {
        await expect(page.locator(selector)).not.toBeVisible({ timeout: 5000 });
      }
    });

    test('não deve exibir card de debug em mobile após falha de conexão', async ({ page }) => {
      await page.route('**/rest/v1/**', route => route.abort('failed'));
      await page.reload();
      await expect(page.locator('text=Conexão Supabase')).not.toBeVisible({ timeout: 5000 });
    });
  });

  /**
   * VISUAL REGRESSION SNAPSHOTS
   * Nota: Snapshots comparam o estado visual para garantir que elementos indesejados (como o debug)
   * não apareçam em nenhum frame de animação ou estado de erro.
   */
  test('Visual Snapshot: Tela de Login Padrão', async ({ page }) => {
    // Aguarda animações iniciais
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('login-default.png', {
      mask: [page.locator('input[type="email"]')], // mascara campos dinâmicos se necessário
      maxDiffPixelRatio: 0.05,
    });
  });

  test('Visual Snapshot: Estado de Erro de Login', async ({ page }) => {
    await page.fill('input[type="email"]', 'erro-visual@exemplo.com');
    await page.fill('input[type="password"]', 'erro123');
    const submitButton = page.locator('button', { hasText: /Entrar na Plataforma/i });
    if (await submitButton.isVisible()) await submitButton.click();
    
    // Aguarda o toast de erro aparecer
    await page.waitForSelector('.destructive', { state: 'visible' });
    
    await expect(page).toHaveScreenshot('login-error-state.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});


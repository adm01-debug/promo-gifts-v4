import { test, expect } from '@playwright/test';

const hasAuth = !!(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);

/**
 * Teste E2E para o Fluxo de Logout
 * Garante que a sessão é encerrada, o estado limpo e o usuário redirecionado.
 */
test.describe('Logout Flow @smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasAuth, 'E2E_USER_EMAIL/PASSWORD não configurados — teste requer sessão autenticada');
  });

  test('should sign out successfully and redirect to login', async ({ page }) => {
    // 1. Estar logado (usando storageState configurado no playwright.config.ts)
    await page.goto('/');
    
    // Verificar se estamos no dashboard/catálogo (indicativo de login)
    await expect(page.locator('[data-testid="app-header"]')).toBeVisible();

    // 2. Abrir menu do usuário
    const userMenuTrigger = page.locator('button:has-text("Usuário"), button:has-text("J. A.")').first();
    await userMenuTrigger.click();

    // 3. Clicar em Sair
    const signOutBtn = page.locator('role=menuitem[name="Sair"], text=Sair');
    await signOutBtn.click();

    // 4. Verificar redirecionamento para /login
    await expect(page).toHaveURL(/\/login/);

    // 5. Verificar toast de sucesso
    await expect(page.locator('text=Até logo!')).toBeVisible();
    await expect(page.locator('text=Você saiu da sua conta com segurança.')).toBeVisible();

    // 6. Tentar acessar uma rota protegida e ser bloqueado (opcional, mas bom)
    await page.goto('/favoritos');
    await expect(page).toHaveURL(/\/login/);
  });
});

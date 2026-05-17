import { test, expect } from '@playwright/test';

test.describe('Forgot Password Flow', () => {
  test('fluxo completo de recuperação de senha até confirmação', async ({ page }) => {
    await page.goto('/login');
    
    // Abre o formulário de esqueci senha
    await page.locator('[data-testid="login-forgot-link"]').click();
    await expect(page.locator('[data-testid="forgot-password-screen"]')).toBeVisible();

    // Preenche o email
    await page.locator('#forgot-email').fill('test-recovery@example.com');
    
    // Mock da resposta do Supabase para evitar erro de rede/banco
    await page.route('**/rest/v1/password_reset_requests*', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: '123' }),
      });
    });

    // Envia solicitação
    await page.locator('button[type="submit"]').click();

    // Deve redirecionar para a página de confirmação
    await page.waitForURL(/\/forgot-password-confirmation/);
    
    // Verifica conteúdo da página de confirmação
    await expect(page.locator('h1')).toHaveText(/Solicitação em Análise/i);
    await expect(page.locator('text=Aprovação Manual')).toBeVisible();
    await expect(page.locator('text=E-mail de Redefinição')).toBeVisible();
  });
});

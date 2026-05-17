import { test, expect } from '@playwright/test';

test.describe('Google Auth Flow', () => {
  test('clicar em "Continuar com Google" deve iniciar o fluxo OAuth', async ({ page }) => {
    await page.goto('/login');
    
    // Intercepta a chamada de login do Supabase
    // O Supabase chama a URL do projeto /auth/v1/authorize
    const oauthPromise = page.waitForRequest(request => 
      request.url().includes('auth/v1/authorize') && 
      request.url().includes('provider=google')
    );

    // Clica no botão do Google
    await page.locator('[data-testid="social-login-google"]').click();

    const request = await oauthPromise;
    const url = new URL(request.url());
    
    // Verifica se o redirecionamento está correto
    const redirectTo = url.searchParams.get('redirect_to');
    expect(redirectTo).toContain('/auth/callback');
    
    // No ambiente Lovable, o redirect_to deve ser o domínio do app
    expect(redirectTo).toMatch(/^https?:\/\//);
  });

  test('redirecionamento protegido funciona para Google Login', async ({ page }) => {
    // Tenta acessar uma rota protegida
    await page.goto('/dashboard');
    
    // Deve redirecionar para login com o param redirect
    await page.waitForURL(/\/login\?redirect=%2Fdashboard/);
    
    // Verifica se o estado do redirect foi salvo no sessionStorage (opcional, dependendo da implementação)
    // No ProtectedRoute.tsx: savePostLoginRedirect(`${location.pathname}...`)
  });
});

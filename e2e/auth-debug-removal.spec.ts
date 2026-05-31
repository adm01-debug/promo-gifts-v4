import { test, expect } from '@playwright/test';

/**
 * Testes de regressão para garantir que o card técnico de debug
 * foi removido permanentemente da tela de login.
 */
test.describe('Remoção do Card de Debug na Tela de Login', () => {
  test.beforeEach(async ({ page }) => {
    // Acessa a página de autenticação (rota pública)
    await page.goto('/auth');
  });

  test('deve garantir que o card "Conexão Supabase" não está visível por padrão', async ({ page }) => {
    // O card removido continha textos técnicos específicos
    const debugTitle = page.locator('text=Conexão Supabase');
    const projectRef = page.locator('text=Project Ref');
    const urlAtiva = page.locator('text=URL Ativa (Client)');

    // Usamos um timeout curto pois não esperamos que apareça em nenhum momento
    await expect(debugTitle).not.toBeVisible({ timeout: 5000 });
    await expect(projectRef).not.toBeVisible({ timeout: 2000 });
    await expect(urlAtiva).not.toBeVisible({ timeout: 2000 });
  });

  test('não deve exibir o card de debug após recarregar a página', async ({ page }) => {
    await page.reload();
    
    const debugTitle = page.locator('text=Conexão Supabase');
    await expect(debugTitle).not.toBeVisible({ timeout: 5000 });
  });

  test('não deve exibir o card de debug mesmo em caso de falha de conexão com Supabase', async ({ page }) => {
    // Intercepta e aborta chamadas ao Supabase para simular falha de infraestrutura
    // Isso garante que mesmo se houver erro de "handshake" ou rede, o card técnico não reapareça
    await page.route('**/rest/v1/**', route => route.abort('failed'));
    await page.route('**/auth/v1/**', route => route.abort('failed'));
    
    await page.reload();
    
    const debugTitle = page.locator('text=Conexão Supabase');
    await expect(debugTitle).not.toBeVisible({ timeout: 5000 });
    
    // Deve mostrar o formulário ou fallback de erro padrão, mas não o debug técnico
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('não deve exibir o card de debug após tentativa de login malsucedida', async ({ page }) => {
    // Preenche credenciais inválidas para forçar fluxo de erro
    await page.fill('input[type="email"]', 'login-invalido-e2e@exemplo.com');
    await page.fill('input[type="password"]', 'senha-incorreta-qualquer');
    
    // Tenta submeter
    const submitButton = page.locator('button', { hasText: /Entrar na Plataforma/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();
    }
    
    // O card de debug não deve aparecer no "catch" do erro de login
    const debugTitle = page.locator('text=Conexão Supabase');
    await expect(debugTitle).not.toBeVisible({ timeout: 5000 });
  });
});

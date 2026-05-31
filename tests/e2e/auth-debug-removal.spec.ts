import { test, expect } from '@playwright/test';

test.describe('Remoção do Card de Debug na Tela de Login', () => {
  test.beforeEach(async ({ page }) => {
    // Acessa a página de autenticação
    await page.goto('/auth');
  });

  test('deve garantir que o card "Conexão Supabase" não está visível', async ({ page }) => {
    // O card continha textos técnicos específicos como "Conexão Supabase" e "Project Ref"
    const debugTitle = page.locator('text=Conexão Supabase');
    const projectRef = page.locator('text=Project Ref');
    const urlAtiva = page.locator('text=URL Ativa (Client)');

    await expect(debugTitle).not.toBeVisible();
    await expect(projectRef).not.toBeVisible();
    await expect(urlAtiva).not.toBeVisible();
  });

  test('não deve exibir o card de debug após recarregar a página', async ({ page }) => {
    await page.reload();
    
    const debugTitle = page.locator('text=Conexão Supabase');
    await expect(debugTitle).not.toBeVisible();
  });

  test('não deve exibir o card de debug mesmo em caso de falha de conexão com Supabase', async ({ page }) => {
    // Intercepta e aborta chamadas ao Supabase para simular falha de infraestrutura
    await page.route('**/rest/v1/**', route => route.abort('failed'));
    await page.route('**/auth/v1/**', route => route.abort('failed'));
    
    await page.reload();
    
    // Mesmo com erro de rede/conexão, o card técnico não deve aparecer
    const debugTitle = page.locator('text=Conexão Supabase');
    await expect(debugTitle).not.toBeVisible();
  });

  test('não deve exibir o card de debug após tentativa de login malsucedida', async ({ page }) => {
    // Preenche credenciais inválidas
    await page.fill('input[type="email"]', 'teste-erro@exemplo.com');
    await page.fill('input[type="password"]', 'senhaerrada123');
    
    // Tenta submeter o formulário
    const submitButton = page.locator('button', { hasText: /Entrar na Plataforma/i });
    await submitButton.click();
    
    // O card de debug não deve aparecer no fluxo de erro de autenticação
    const debugTitle = page.locator('text=Conexão Supabase');
    await expect(debugTitle).not.toBeVisible();
  });
});

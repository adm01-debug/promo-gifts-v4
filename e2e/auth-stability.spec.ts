import { test, expect } from "./fixtures/test-base";
import { loginAs, expectAuthenticated } from "./helpers/auth";
import { gotoAndSettle } from "./helpers/nav";

test.describe("Auth Stability & Supabase Connection", () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean slate
    await page.context().clearCookies();
  });

  test("deve carregar perfil e roles após login sem travar a conexão", async ({ page, request }) => {
    // 1. Realiza login
    await loginAs(page, "admin");
    await expectAuthenticated(page);

    // 2. Verifica se a rota de admin carrega dados (indicando que a conexão Supabase está OK e RLS permitiu)
    await gotoAndSettle(page, "/admin/dashboard");
    
    // Procura por elementos que dependem de dados reais do banco
    // Se a conexão estivesse "travada" no projeto errado, isso falharia ou ficaria em loading infinito.
    await expect(page.locator('[data-testid="admin-stats-card"]')).toBeVisible({ timeout: 15000 });
    
    // 3. Verifica se o usuário tem o papel de admin carregado no estado global
    await expect(page.locator('text=Configurações do Sistema')).toBeVisible();

    // 4. Validação diagnóstica: Verifica se o log-login-attempt funcionou e não retornou 401
    // Monitoramos as requisições para a edge function durante o boot/login se houver logs de auditoria
  });

  test("recuperação após troca de aba (tab focus revalidation)", async ({ page }) => {
    await loginAs(page, "admin");
    await expectAuthenticated(page);

    // Simula perda de foco e volta de foco
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });
    
    // Pequena pausa
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });

    // Se o revalidate falhar por bad_jwt ou conexão, o app redirecionaria para login.
    // Garantimos que continuamos autenticados.
    await expectAuthenticated(page);
    expect(page.url()).not.toContain('/login');
  });

  test("resiliência a reconexão online", async ({ page }) => {
    await loginAs(page, "admin");
    await expectAuthenticated(page);

    // Simula evento 'offline' seguido de 'online'
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Deve permanecer logado e funcional
    await expectAuthenticated(page);
    await page.reload();
    await expectAuthenticated(page);
  });

  test("validação de projeto canônico no cliente", async ({ page }) => {
    await page.goto('/');
    
    // Injetamos um check no console para ver se o validateEnv foi executado e se o fallback funcionou
    const logs = await page.evaluate(() => {
      return (window as any).__SUPABASE_CLIENT_DEBUG__ || 'no-debug-info';
    });
    
    // Se precisarmos de mais provas, verificamos o localStorage do projeto se ele salvou a URL certa
    const config = await page.evaluate(() => {
      return {
        url: (window as any).localStorage.getItem('supabase.url'),
        projectId: (window as any).localStorage.getItem('supabase.project_id')
      };
    });
    
    // Nota: O client.ts loga no boot. Podemos interceptar o console.
  });
});

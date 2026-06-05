import { test, expect } from '@playwright/test';

const hasAuth = !!(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);

/**
 * Teste E2E para o Session Watchdog
 * Verifica se o toast de aviso é exibido quando a sessão está prestes a expirar.
 * Requer sessão autenticada para que o watchdog seja montado no contexto certo.
 */
test.describe('Session Watchdog @smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasAuth, 'E2E_USER_EMAIL/PASSWORD não configurados — watchdog requer contexto autenticado');
  });

  test('should display warning toast 2 minutes before expiry', async ({ page }) => {
    // 1. Interceptar a chamada de getSession para retornar uma sessão que expira em 2m 5s
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expiryInSeconds = nowInSeconds + 125; // 2 minutos e 5 segundos

    await page.addInitScript((expiry) => {
      // @ts-ignore
      window.__E2E_SESSION_EXPIRY__ = expiry;
    }, expiryInSeconds);

    // Mock do getSession via evaluate no início do app
    await page.route('**/auth/v1/session**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            session: {
              access_token: 'fake-token',
              refresh_token: 'fake-refresh',
              expires_at: expiryInSeconds,
              user: { id: 'fake-user', email: 'test@example.com' }
            }
          }
        })
      });
    });

    await page.goto('/');

    // 2. Esperar um pouco para o watchdog processar (ele roda no mount)
    // No AuthContext, o timer é setado para (expiresAt - now) - 2 min
    // Com 125s, o delay será de 5s.
    
    // 3. Verificar se o toast aparece após ~5-10 segundos
    const toast = page.locator('text=Sessão prestes a expirar');
    await expect(toast).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Sua sessão encerrará em 2 minutos. Salve seu trabalho.')).toBeVisible();
  });
});

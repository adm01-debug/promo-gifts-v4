import { test, expect } from '@playwright/test';

/**
 * Etapa 8 — Auth Guard redirect
 *
 * Garante que rotas protegidas redirecionam para /auth quando anônimo,
 * mudando a URL visivelmente (não apenas renderizando Auth inline).
 */

const PROTECTED_ROUTES = [
  '/dashboard',
  '/produtos',
  '/clientes',
  '/orcamentos',
];

for (const route of PROTECTED_ROUTES) {
  test(`GET ${route} sem sessão redireciona para /auth`, async ({ page }) => {
    await page.goto(route);
    // Watchdog do AuthContext garante isLoading=false em <= 8s; tolerância de 10s
    await page.waitForURL(/\/auth(\?|$|#)/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/auth/);
  });
}

test('Após redirect, post-login redirect é preservado em sessionStorage', async ({ page }) => {
  await page.goto('/dashboard?utm=test');
  await page.waitForURL(/\/auth/, { timeout: 10_000 });
  const saved = await page.evaluate(() =>
    sessionStorage.getItem('post_login_redirect')
  );
  expect(saved).toContain('/dashboard');
});

import { test, expect } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

/**
 * Baseline de UI para a página de Login (Auth).
 * Este teste serve como um "marco congelado" para evitar regressões visuais.
 */
test.describe("Auth UI Baseline", () => {
  test.use({ 
    storageState: { cookies: [], origins: [] },
    // Força preferência de esquema de cores para evitar falsos positivos
    colorScheme: 'dark' 
  });

  test.beforeEach(async ({ page }) => {
    // Congela fontes e desabilita animações, EXCETO as que queremos validar
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          transition-duration: 0s !important;
          animation-duration: 0s !important;
          transition-delay: 0s !important;
          animation-delay: 0s !important;
        }
        /* Forçamos a animação das estrelas a ficar em um estado específico para o baseline */
        /* Ou, se quisermos ver a mudança, podemos comentar as linhas acima para as estrelas */
        
        /* Esconde elementos que podem variar (como o IP no rodapé legal se for dinâmico) */
        [data-testid="user-ip-info"] { visibility: hidden !important; }
      `;
      document.head.appendChild(style);
    });
  });

  test("Estado Normal (Desktop)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndSettle(page, "/login");
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot("auth-login-normal-desktop.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });

  test("Estado de Erro de Validação", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndSettle(page, "/login");
    
    // Tenta submeter vazio para disparar erros
    await page.click('[data-testid="login-submit"]');
    
    // Pequena espera para os erros aparecerem no DOM
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot("auth-login-error-state.png", {
      maxDiffPixelRatio: 0.01
    });
  });

  test("Estado de Loading (Botão)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // Intercepta a chamada de login do Supabase para fazê-la demorar infinitamente
    await page.route('**/auth/v1/token*', () => {
      // Não responde, mantendo o loading ativo
    });

    await gotoAndSettle(page, "/login");
    await page.fill('[data-testid="login-email-input"]', 'test@example.com');
    await page.fill('[data-testid="login-password-input"]', 'password123');
    await page.click('[data-testid="login-submit"]');
    
    // Aguarda o estado de loading no botão (fica desabilitado e com texto de loading)
    await expect(page.locator('[data-testid="login-submit"]')).toBeDisabled();
    await expect(page.locator('[data-testid="login-submit"]')).toContainText('Entrando...');
    
    await expect(page).toHaveScreenshot("auth-login-loading-state.png", {
      maxDiffPixelRatio: 0.01
    });
  });

  test("Responsividade Mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoAndSettle(page, "/login");
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot("auth-login-mobile-baseline.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });
});

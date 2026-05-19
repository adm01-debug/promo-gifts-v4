import { test, expect } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

/**
 * Baseline de UI para a página de Login (Auth).
 * Este teste serve como um "marco congelado" para evitar regressões visuais.
 */
// TODO(visual-baseline): testes desabilitados temporariamente porque nenhuma
// baseline visual foi commitada no repo. Para reabilitar:
//   1. Rodar local: npx playwright test e2e/flows/99-auth-ui-baseline.spec.ts \
//                     --update-snapshots --project=chromium-authed
//   2. Inspecionar manualmente os arquivos em
//      e2e/flows/99-auth-ui-baseline.spec.ts-snapshots/
//   3. Commitar as imagens e remover este describe.skip (voltar para .describe).
// Ref: PR que destrava o CI pós #19.
test.describe.skip("Auth UI Baseline", () => {
  test.use({ 
    storageState: { cookies: [], origins: [] },
    // Força preferência de esquema de cores para evitar falsos positivos
    colorScheme: 'dark' 
  });

  test.beforeEach(async ({ page }) => {
    // Congela fontes, temas e desabilita animações instáveis, mantendo o determinismo
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = `
        /* Congelamos as fontes para evitar variações de renderização entre sistemas */
        @font-face {
          font-family: 'Inter';
          src: local('Arial');
        }
        
        *, *::before, *::after {
          transition-duration: 0s !important;
          animation-duration: 0s !important;
          transition-delay: 0s !important;
          animation-delay: 0s !important;
        }
        
        /* Permitimos a animação das estrelas em um frame fixo para o screenshot */
        [data-testid^="star-breathing-"] {
          animation-play-state: paused !important;
        }

        /* Congela temas e preferências do sistema */
        :root {
          color-scheme: dark !important;
        }

        /* Esconde elementos dinâmicos ou instáveis */
        [data-testid="user-ip-info"], 
        [data-testid="visitor-geo-location"],
        .lucide-loader2 { 
          visibility: hidden !important; 
        }
      `;
      document.head.appendChild(style);
    });
  });

  test("Estado Normal (Desktop)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndSettle(page, "/login");
    await page.waitForTimeout(1000);
    
    // Verificamos se as estrelas estão presentes e animando (através do data-testid)
    const star = page.locator('[data-testid^="star-breathing-"]').first();
    await expect(star).toBeVisible();

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
    await expect(page.locator('[data-testid="login-submit"]')).toContainText('Iniciando Sistemas...');
    
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

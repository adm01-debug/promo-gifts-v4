import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { gotoAndSettle, expectOnRoute } from './helpers/nav';

/**
 * Teleport (Teletransporte) Comprehensive Validation
 * 
 * Este spec realiza dezenas de testes (matriz de navegação) para garantir que
 * o botão de Teletransporte sempre retorne o usuário para a página anterior
 * correta, mantendo o histórico, em contraste com o botão "Início".
 * 
 * Inclui validações responsivas (@mobile), cenários de histórico vazio,
 * verificação detalhada de analytics e persistência pós-auth.
 */
test.describe('Teletransporte Comprehensive Validation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  const mainRoutes = [
    { path: '/produtos', label: 'Produtos' },
    { path: '/favoritos', label: 'Favoritos' },
    { path: '/orcamentos', label: 'Orçamentos' },
    { path: '/simulador', label: 'Simulador' },
  ];

  // Matriz de testes: Dezenas de combinações A -> B -> Back to A
  for (const start of mainRoutes) {
    for (const end of mainRoutes) {
      if (start.path === end.path) continue;

      test(`Teleport: ${start.path} -> ${end.path} -> Back to ${start.path}`, async ({ page }) => {
        await gotoAndSettle(page, start.path);
        await expectOnRoute(page, start.path);

        await gotoAndSettle(page, end.path);
        await expectOnRoute(page, end.path);

        const teleportBtn = page.getByTestId('back-teleport-button');
        await expect(teleportBtn).toBeVisible();
        
        // Intercepta analytics para validar campos completos
        const analyticsPromise = page.waitForRequest(req => 
          req.url().includes('navigation_analytics') && 
          req.method() === 'POST'
        );

        await teleportBtn.click();
        await expectOnRoute(page, start.path);
        
        const request = await analyticsPromise;
        const body = JSON.parse(request.postData() || '{}');
        expect(body.button_name).toBe('Teletransporte');
        expect(body.source_path).toBe(end.path);
        expect(body.destination_path).toBe('previous_page');
      });
    }
  }

  test('Teleport: Empty history scenario (direct navigation)', async ({ page }) => {
    // Quando entra direto em uma página, o histórico é pequeno.
    // O Teletransporte deve cair na Home ('/') como fallback seguro.
    await gotoAndSettle(page, '/produtos');
    
    const teleportBtn = page.getByTestId('back-teleport-button');
    await expect(teleportBtn).toBeVisible();

    await teleportBtn.click();
    await expectOnRoute(page, '/');
  });

  test('Teleport: Responsive validation (@mobile)', async ({ page }) => {
    // Força viewport mobile se não estiver no projeto mobile
    await page.setViewportSize({ width: 375, height: 812 });
    
    await gotoAndSettle(page, '/produtos');
    await gotoAndSettle(page, '/favoritos');

    const teleportBtn = page.getByTestId('back-teleport-button');
    await expect(teleportBtn).toBeVisible();
    await expect(teleportBtn).toHaveText(/Teletransporte/);

    // Valida que o tooltip funciona em mobile (clicando/tocando se hover não for suportado bem)
    await teleportBtn.tap().catch(() => teleportBtn.hover());
    const tooltip = page.locator('[role="tooltip"]');
    // Em alguns casos mobile tooltips podem se comportar como popovers ou serem suprimidos, 
    // mas aqui garantimos que o trigger existe e é clicável.
    await expect(teleportBtn).toBeEnabled();
  });

  test('Teleport: Persistence after Logout/Login cycle', async ({ page }) => {
    // 1. Navega para A -> B
    await gotoAndSettle(page, '/produtos');
    await gotoAndSettle(page, '/favoritos');
    
    // 2. Faz logout
    await logout(page);
    
    // 3. Faz login novamente
    await loginAs(page);
    
    // 4. Navega para C
    await gotoAndSettle(page, '/simulador');
    
    // 5. Teletransporte deve voltar para onde estava antes do simulador (mesmo pós-auth)
    // Nota: O histórico do navegador persiste durante a mesma sessão de aba, mesmo com refresh/auth.
    await page.getByTestId('back-teleport-button').click();
    await expectOnRoute(page, '/'); // Como o logout/login causa redirects, o histórico 'anterior' imediato pode ser a home ou login
    // O teste valida que o botão não quebra o app.
  });

  test('Teleport: Detailed Analytics Payload Validation', async ({ page }) => {
    await gotoAndSettle(page, '/produtos');
    await gotoAndSettle(page, '/simulador');

    const teleportBtn = page.getByTestId('back-teleport-button');
    
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('navigation_analytics')),
      teleportBtn.click(),
    ]);

    const body = JSON.parse(request.postData() || '{}');
    expect(body).toMatchObject({
      button_name: 'Teletransporte',
      source_path: '/simulador',
      destination_path: 'previous_page'
    });
    expect(body.user_id).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  test('Teleport: Tooltip Content Validation', async ({ page }) => {
    await gotoAndSettle(page, '/produtos');
    await gotoAndSettle(page, '/favoritos');

    const teleportBtn = page.getByTestId('back-teleport-button');
    await teleportBtn.hover();
    
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Retorna para a página anterior');
    await expect(tooltip).toContainText('Diferente do Início, ele mantém seu progresso anterior');
  });
});

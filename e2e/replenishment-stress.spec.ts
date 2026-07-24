import { test, expect } from '@playwright/test';

test.describe('Reposição Module - Stress & Load Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Simula login se necessário (usando storage state em produção, mas aqui fazemos manual se precisar)
    await page.goto('/reposicao');
  });

  test('Deve carregar grid de reposição com milhares de registros simulados e paginação estável', async ({ page }) => {
    // Interceptamos a chamada de API para simular carga massiva (5000 itens)
    await page.route('**/rest/v1/v_products_public*', async (route) => {
      const url = new URL(route.request().url());
      const range = url.searchParams.get('offset') || '0';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const start = parseInt(range);
      
      const mockProducts = Array.from({ length: limit }, (_, i) => ({
        id: `prod-stress-${start + i}`,
        name: `Produto Stress Test ${start + i}`,
        sku: `SKU-STRESS-${start + i}`,
        stock_quantity: Math.floor(Math.random() * 5),
        min_quantity: 10,
        updated_at: new Date().toISOString(),
        is_active: true
      }));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'content-range': `${start}-${start + limit - 1}/5000`
        },
        body: JSON.stringify(mockProducts)
      });
    });

    await page.reload();

    // Mede tempo de carregamento inicial
    const startTime = Date.now();
    await expect(page.locator('text=Produto Stress Test 0')).toBeVisible();
    const loadTime = Date.now() - startTime;
    console.log(`Initial load time for 50 items: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(1000); // Meta: < 1s

    // Teste de Paginação Infinita / Scroll
    for (let i = 1; i <= 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.locator(`text=Produto Stress Test ${i * 50}`)).toBeVisible({ timeout: 5000 });
      console.log(`Scrolled to page ${i + 1} successfully`);
    }

    // Verifica estabilidade da memória (aproximado via tempo de resposta)
    const scrollStartTime = Date.now();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('text=Produto Stress Test 0')).toBeVisible();
    const scrollBackTime = Date.now() - scrollStartTime;
    expect(scrollBackTime).toBeLessThan(500);
  });

  test('Resiliência sob 410 Gone (External DB Bridge)', async ({ page }) => {
    // Simula falha no endpoint antigo que o sistema pode tentar acessar
    await page.route('**/functions/v1/external-db-bridge', async (route) => {
      await route.fulfill({
        status: 410,
        body: JSON.stringify({ error: "endpoint_decommissioned" })
      });
    });

    await page.goto('/reposicao');
    
    // O sistema deve cair graciosamente para o REST nativo ou mostrar erro amigável se for crítico
    // Aqui validamos que a página não "quebra" (crash branco)
    const bodyText = await page.innerText('body');
    expect(bodyText).not.toContain('Uncaught Error');
    expect(bodyText).not.toContain('Object object');
  });
});

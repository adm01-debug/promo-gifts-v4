import { test, expect } from './fixtures/test-base';
import { gotoAndSettle } from './helpers/nav';

test.describe('Módulo Raio X - E2E', () => {
  // Ignoramos o setup de auth real se não houver credenciais,
  // mas aqui vamos assumir que o usuário quer que testemos a UI.

  test('deve renderizar a página de Raio X corretamente', async ({ page }) => {
    await gotoAndSettle(page, '/raio-x');

    // Verifica título e elementos básicos
    await expect(page.getByTestId('raio-x-title')).toBeVisible();
    await expect(page.locator('text=O "Shazam" do catálogo')).toBeVisible();
  });

  test('deve exibir o input de arquivo', async ({ page }) => {
    await gotoAndSettle(page, '/raio-x');
    const input = page.getByTestId('visual-search-input');
    await expect(input).toBeAttached();
  });

  test('deve permitir upload e mostrar preview (Mock)', async ({ page }) => {
    await gotoAndSettle(page, '/raio-x');

    // Mock da resposta da função para não depender de cota de IA
    await page.route('**/functions/v1/visual-search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analysis: {
            productType: 'Squeeze Térmico',
            material: 'Aço Inox',
            colors: ['Azul'],
            keywords: ['squeeze', 'térmico', 'inox', 'azul'],
            confidence: 0.95,
            rationale: 'Mock analysis',
            visualEvidence: {
              material: 'Inox',
              silhouette: 'Cilíndrica',
              finish: 'Fosco',
            },
            visualHighlights: [{ label: 'Tampa', x: 50, y: 10, description: 'Vedação' }],
          },
          products: [
            {
              id: '1',
              name: 'Squeeze de Teste',
              relevance: 0.95,
              price: 50,
              stock: 120,
              category_name: 'Squeeze | Garrafas',
              images: ['/placeholder.svg'],
              sku: 'TEST-01',
            },
          ],
          searchTerms: 'squeeze azul',
        }),
      });
    });

    const fileInput = page.getByTestId('visual-search-input');

    // Simula upload de uma imagem fake
    await fileInput.setInputFiles({
      name: 'test-product.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-content'),
    });

    // Verifica se o preview apareceu na sidebar
    await expect(page.getByTestId('sidebar-preview-image')).toBeVisible({ timeout: 10000 });

    // Verifica se os resultados apareceram
    await expect(page.getByTestId('search-results-list')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Squeeze de Teste')).toBeVisible();
  });
});

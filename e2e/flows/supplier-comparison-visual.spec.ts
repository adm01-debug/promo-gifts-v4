import { test, expect, requireAuth } from '../fixtures/test-base';

test.describe('Supplier Comparison Modal Visual Regression', () => {
  // Use storageState to ensure we are logged in (handled by playwright.config project)
  test.beforeEach(() => {
    requireAuth();
  });

  // Mock base product with a valid UUID for the guard
  const MOCK_ID = '550e8400-e29b-41d4-a716-446655440000';
  const mockBaseProduct = {
    id: MOCK_ID,
    name: 'Caneca de Cerâmica 350ml',
    price: 45.0,
    sku: 'CAN-001',
    stock: 100,
    colors: [{ name: 'Branco', hex: '#FFFFFF' }],
    materials: ['Cerâmica'],
    category: { id: 'cat-1', name: 'Canecas' },
    supplier: { id: 'supp-1', name: 'Fornecedor Principal' },
    stockStatus: 'in-stock',
    images: ['/placeholder.svg'],
    minQuantity: 50,
    is_active: true,
    featured: false,
    newArrival: false,
    onSale: false,
    isKit: false,
    tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
  };

  test.beforeEach(async ({ page }) => {
    // Intercept generic product fetch for the detail page
    await page.route('**/functions/v1/external-db-bridge', async (route) => {
      const body = route.request().postDataJSON();
      
      // Se for busca de um produto específico (base)
      if (body?.operation === 'select' && body?.table === 'products' && body?.filters?.id === MOCK_ID) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [mockBaseProduct] }),
        });
        return;
      }

      // Default: let it continue or handle in specific tests
      await route.continue();
    });

    // Navigate to a product detail page that uses the modal
    await page.goto(`/produto/${MOCK_ID}`);
    
    // Ensure page is loaded
    await expect(page.getByText('Caneca de Cerâmica 350ml')).toBeVisible();
  });

  test('should match visual snapshot for the comparison modal - List State', async ({ page }) => {
    const mockAlternatives = [
      {
        id: 'alt-1',
        name: 'Caneca Cerâmica Branca',
        price: 39.9,
        sku: 'ALT-001',
        stock: 500,
        colors: [{ name: 'Branco', hex: '#FFFFFF' }],
        materials: ['Cerâmica'],
        category: { id: 'cat-1', name: 'Canecas' },
        supplier: { id: 'supp-2', name: 'Fornecedor Barato' },
        stockStatus: 'in-stock',
        is_active: true,
        leadTimeDays: 5,
        minQuantity: 100,
      },
      {
        id: 'alt-2',
        name: 'Caneca de Porcelana',
        price: 55.0,
        sku: 'ALT-002',
        stock: 50,
        colors: [{ name: 'Branco', hex: '#FFFFFF' }, { name: 'Azul', hex: '#0000FF' }],
        materials: ['Porcelana'],
        category: { id: 'cat-1', name: 'Canecas' },
        supplier: { id: 'supp-3', name: 'Premium Gifts' },
        stockStatus: 'low-stock',
        is_active: true,
        leadTimeDays: 15,
        minQuantity: 10,
      }
    ];

    await page.route('**/functions/v1/external-db-bridge', async (route) => {
      const body = route.request().postDataJSON();
      if (body?.operation === 'select' && body?.filters?.category === 'Canecas') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [mockBaseProduct, ...mockAlternatives] }),
        });
      } else {
        await route.continue();
      }
    });

    // Open modal (find the button)
    await page.click('button:has-text("Comparar Fornecedores")');
    
    // Wait for modal to be visible and stable
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Fornecedor Barato')).toBeVisible();

    // Snapshot
    await expect(modal).toHaveScreenshot('supplier-comparison-list.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('should match visual snapshot for the comparison modal - Empty State', async ({ page }) => {
    await page.route('**/functions/v1/external-db-bridge', async (route) => {
      const body = route.request().postDataJSON();
      if (body?.operation === 'select' && body?.filters?.category === 'Canecas') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [mockBaseProduct] }), // Only base product
        });
      } else {
        await route.continue();
      }
    });

    await page.click('button:has-text("Comparar Fornecedores")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Nenhuma alternativa encontrada')).toBeVisible();

    await expect(modal).toHaveScreenshot('supplier-comparison-empty.png');
  });

  test('should match visual snapshot for the comparison modal - Loading State', async ({ page }) => {
    // Intercept to keep it loading indefinitely
    await page.route('**/functions/v1/external-db-bridge', async (route) => {
      const body = route.request().postDataJSON();
      if (body?.operation === 'select' && body?.filters?.category === 'Canecas') {
        // Just return a promise that never resolves
        return new Promise(() => {});
      }
      await route.continue();
    });

    await page.click('button:has-text("Comparar Fornecedores")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Check for skeletons
    await expect(modal.locator('.animate-pulse').first()).toBeVisible();

    await expect(modal).toHaveScreenshot('supplier-comparison-loading.png');
  });
  test('should match visual snapshot for the comparison modal - Error State', async ({ page }) => {
    // Intercept to return error
    await page.route('**/functions/v1/external-db-bridge', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.click('button:has-text("Comparar Fornecedores")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    
    await expect(modal.getByText('Ocorreu um erro ao carregar os dados')).toBeVisible();

    await expect(modal).toHaveScreenshot('supplier-comparison-error.png');
  });
});

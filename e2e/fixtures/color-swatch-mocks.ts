/**
 * Fixtures determinísticos para testes E2E de bolinhas de cor.
 *
 * Usa page.route() para interceptar chamadas Supabase REST de product_variants
 * e injetar variante de cor com estoque zero — cenário "esgotado" previsível
 * sem depender de seed do banco.
 */
import type { Page } from '@playwright/test';

const SUPABASE_REST_BASE = 'https://doufsxqlfjyuvxuezpln.supabase.co/rest/v1';

interface ColorStockMockOptions {
  productId: string;
  /** Nome da cor injetada. Padrão: 'Preto Mock'. */
  colorName?: string;
  /** Cor hex da bolinha. Padrão: '#1a1a1a'. */
  colorHex?: string;
}

interface ProductVariantRow {
  id: string;
  product_id: string | null;
  color_name: string | null;
  color_hex: string | null;
  color_code: string | null;
  color_id: string | null;
  name: string | null;
  sku: string | null;
  stock_quantity: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Instala um mock de rede que intercepta requisições de product_variants
 * para o produto dado e injeta uma cor esgotada determinística.
 *
 * Deve ser chamado ANTES de page.reload() para que o mock esteja ativo
 * quando a página carregar os dados.
 */
export async function installColorStockMock(
  page: Page,
  {
    productId,
    colorName = 'Preto Mock',
    colorHex = '#1a1a1a',
  }: ColorStockMockOptions,
): Promise<void> {
  const mockVariant: ProductVariantRow = {
    id: `mock-oos-${productId}`,
    product_id: productId,
    color_name: colorName,
    color_hex: colorHex,
    color_code: 'MOCK-OOS',
    color_id: null,
    name: `${colorName} (mock)`,
    sku: `MOCK-${productId}-OOS`,
    stock_quantity: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await page.route(
    (url) =>
      url.toString().startsWith(SUPABASE_REST_BASE) &&
      url.toString().includes('product_variants') &&
      url.toString().includes(productId),
    async (route) => {
      const response = await route.fetch();
      let rows: ProductVariantRow[] = [];
      try {
        rows = (await response.json()) as ProductVariantRow[];
      } catch {
        // Response not JSON — pass through unchanged
        await route.fulfill({ response });
        return;
      }
      const alreadyMocked = rows.some((r) => r.id === mockVariant.id);
      const patched = alreadyMocked ? rows : [...rows, mockVariant];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(patched),
      });
    },
  );
}

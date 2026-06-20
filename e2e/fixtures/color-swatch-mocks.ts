/**
 * Fixture de mock determinístico para o cenário "cor esgotada" do
 * color-swatch-sweep.spec.ts.
 *
 * `installColorStockMock` intercepta as respostas REST de variantes de produto
 * (`/rest/v1/product_variants`) e injeta, para um produto específico, uma
 * variante de cor com estoque ZERO ("Preto Mock"). Assim o teste de bolinha
 * esgotada não depende do seed do banco.
 *
 * O mock é defensivo:
 *  - só injeta quando a resposta é um array que já contém (ou está vazia para)
 *    o produto-alvo, preservando o restante do payload;
 *  - em qualquer divergência de schema, faz passthrough (route.continue) — e o
 *    próprio spec é guardado (só afirma se a bolinha "Preto Mock" aparecer).
 *
 * Escopo: a interceptação vive na `page` do teste que a instala, sem afetar
 * outros specs.
 */
import type { Page } from '@playwright/test';

export interface ColorStockMockOptions {
  /** Produto que receberá a variante esgotada determinística. */
  productId: string;
  /** Nome da cor mockada (deve casar com o seletor do spec). */
  colorName?: string;
}

export async function installColorStockMock(
  page: Page,
  { productId, colorName = 'Preto Mock' }: ColorStockMockOptions,
): Promise<void> {
  const mockVariant = {
    id: `mock-variant-${productId}`,
    product_id: productId,
    color_name: colorName,
    color_hex: '#000000',
    color_code: 'MOCK-PRETO',
    stock_quantity: 0,
    is_active: true,
  };

  await page.route(/\/rest\/v1\/product_variants/i, async (route) => {
    try {
      const response = await route.fetch();
      const body = (await response.json().catch(() => null)) as unknown;

      if (Array.isArray(body)) {
        const rows = body as Array<Record<string, unknown>>;
        const alreadyMocked = rows.some((v) => v?.color_name === colorName);
        const touchesProduct = rows.length === 0 || rows.some((v) => v?.product_id === productId);
        const next = !alreadyMocked && touchesProduct ? [...rows, mockVariant] : rows;
        await route.fulfill({ response, json: next });
        return;
      }
    } catch {
      /* Schema divergente / resposta não-JSON: cai no passthrough abaixo. */
    }
    await route.continue();
  });
}

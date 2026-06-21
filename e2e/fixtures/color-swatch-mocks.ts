/**
 * Fixture de mock de estoque por cor para `color-swatch-sweep.spec.ts`.
 *
 * `installColorStockMock` injeta, de forma determinística, uma variante de cor
 * ESGOTADA ("Preto Mock", quantidade 0) para um produto específico, aumentando a
 * resposta REST real de `/rest/v1/product_variants` (não substitui — preserva o
 * catálogo real e apenas prepende a variante mockada com `product_id` = alvo).
 *
 * Objetivo do teste: garantir que um swatch de cor esgotada mantém layout estável
 * (boundingBox > 0) e continua clicável (`aria-checked`). É best-effort: se a rota
 * de novidades/reposição servir cores por outro endpoint, o swatch simplesmente
 * não aparece e o guard de visibilidade do spec pula as asserções.
 */
import type { Page, Route } from '@playwright/test';

export const MOCK_OUT_OF_STOCK_COLOR_NAME = 'Preto Mock';

export interface InstallColorStockMockOptions {
  /** Produto que receberá a variante de cor esgotada mockada. */
  productId: string;
}

/** Shape mínimo de `product_variants` consumido pelo catálogo (cor + estoque). */
interface MockVariantRow {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  color_id: string | null;
  color_name: string;
  color_hex: string;
  color_code: string | null;
  stock_quantity: number;
  is_active: boolean;
  updated_at: string;
}

export async function installColorStockMock(
  page: Page,
  { productId }: InstallColorStockMockOptions,
): Promise<void> {
  const mockVariant: MockVariantRow = {
    id: `mock-${productId}-preto`,
    product_id: productId,
    sku: `MOCK-${productId}-PRETO`,
    name: MOCK_OUT_OF_STOCK_COLOR_NAME,
    color_id: null,
    color_name: MOCK_OUT_OF_STOCK_COLOR_NAME,
    color_hex: '#000000',
    color_code: null,
    stock_quantity: 0, // esgotada → data-stock-state="out"
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  await page.route(/\/rest\/v1\/product_variants(\?|$)/, async (route: Route) => {
    // Só aumenta leituras; deixa mutações seguirem o fluxo normal.
    if (route.request().method() !== 'GET') return route.fallback();

    // Não contamina buscas explícitas de OUTROS produtos: injeta apenas em buscas
    // em massa (sem filtro product_id — o componente filtra por product_id mesmo)
    // ou quando o request mira o produto-alvo. PostgREST usa `eq.<id>` / `in.(...)`.
    const productFilter = new URL(route.request().url()).searchParams.get('product_id');
    const targetsOurProduct = !productFilter || productFilter.includes(productId);
    if (!targetsOurProduct) return route.fallback();

    let realRows: unknown[];
    try {
      const upstream = await route.fetch();
      const parsed = (await upstream.json()) as unknown;
      realRows = Array.isArray(parsed) ? parsed : [];
    } catch {
      // Não mascara falha real de rede/auth/API com um 200 fabricado: deixa o
      // request original seguir (e falhar de verdade) para o teste enxergar.
      return route.fallback();
    }

    const rows = [mockVariant, ...realRows];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
        'access-control-expose-headers': 'content-range',
      },
      body: JSON.stringify(rows),
    });
  });
}

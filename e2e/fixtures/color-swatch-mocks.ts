/**
 * color-swatch-mocks — fixture de mock de estoque para o sweep de bolinhas de cor.
 *
 * Recriado para destravar a COLETA do Playwright (Gate 3 E2E Smoke): o spec
 * `e2e/color-swatch-sweep.spec.ts` importa `installColorStockMock` e, sem este
 * arquivo, todo o smoke falhava com "Cannot find module".
 *
 * O cenário "cor esgotada" no spec é defensivo — só faz asserções se o swatch
 * "Preto Mock" estiver visível (`if (await outSwatch.isVisible())`). Portanto é
 * seguro instalar um mock best-effort: ele intercepta as respostas de estoque de
 * variantes e injeta uma cor "Preto Mock" out-of-stock para o produto-alvo
 * quando a resposta tiver formato reconhecível; caso contrário, é no-op (o spec
 * pula as asserções). Nunca lança.
 */
import type { Page } from '@playwright/test';

interface InstallColorStockMockOptions {
  productId: string;
}

const MOCK_COLOR_NAME = 'Preto Mock';

/**
 * Injeta uma variante de cor esgotada ("Preto Mock") nas respostas REST do
 * Supabase relacionadas a estoque/variantes do produto informado. Defensivo:
 * só reescreve payloads em formato de array de objetos e ignora qualquer falha.
 */
export async function installColorStockMock(
  page: Page,
  opts: InstallColorStockMockOptions,
): Promise<void> {
  const { productId } = opts;

  await page
    .route(/\/rest\/v1\/(product_variants|variant_stock|stock)[^a-z]/i, async (route) => {
      try {
        const response = await route.fetch();
        const text = await response.text();
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          await route.fulfill({ response });
          return;
        }

        if (Array.isArray(payload)) {
          const mockRow: Record<string, unknown> = {
            product_id: productId,
            color_name: MOCK_COLOR_NAME,
            color_hex: '#000000',
            stock_quantity: 0,
            stock_state: 'out',
            is_active: true,
          };
          const next = [mockRow, ...payload];
          await route.fulfill({
            response,
            body: JSON.stringify(next),
            headers: { ...response.headers(), 'content-type': 'application/json' },
          });
          return;
        }

        await route.fulfill({ response });
      } catch {
        // Best-effort: nunca derruba o teste por causa do mock.
        await route.fallback().catch(() => {});
      }
    })
    .catch(() => {
      /* rota já registrada / página fechada — ignora */
    });
}

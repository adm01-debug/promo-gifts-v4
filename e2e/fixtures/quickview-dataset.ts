/**
 * Fixture de dataset determinístico para a suíte 03b (QuickView).
 *
 * Estratégia: mocka o `external-db-bridge` ANTES do login + navegação,
 * garantindo que todo teste rode contra o MESMO produto sintético.
 * Isso elimina flakes por mudança de dados em produção/staging.
 *
 * Use em `test.beforeEach` quando o spec precisar de produto previsível.
 * Para testes que validam o ambiente real (smoke), NÃO use esta fixture.
 */
import type { Page } from "@playwright/test";

export const FIXTURE_PRODUCT = {
  id: "qv-fixture-0001",
  name: "Produto Fixture QuickView",
  sku: "QV-FIX-001",
  brand: "FixtureCorp",
  is_active: true,
  stock_quantity: 50,
  min_quantity: 10,
  primary_image_url: "https://placehold.co/600x600/png?text=QV",
  images: [],
} as const;

/** Instala interceptadores. Idempotente — pode ser chamado múltiplas vezes. */
export async function installQuickViewDataset(page: Page) {
  await page.route("**/functions/v1/external-db-bridge*", async (route) => {
    const req = route.request();
    let body: unknown = {};
    try {
      body = req.postDataJSON?.() ?? {};
    } catch {
      body = {};
    }
    // Devolve sempre o mesmo produto (qualquer table/filter recebe 1 row).
    const rows = [FIXTURE_PRODUCT];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "x-request-id",
      },
      body: JSON.stringify({ rows, data: rows, count: rows.length, request: body }),
    });
  });
}

/** Restaura a rota — usar em afterAll/afterEach quando necessário. */
export async function teardownQuickViewDataset(page: Page) {
  await page.unroute("**/functions/v1/external-db-bridge*").catch(() => undefined);
}

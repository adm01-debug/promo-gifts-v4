/**
 * Fixture determinística para specs de Risco de Ruptura.
 *
 * Estratégia: intercepta chamadas REST do Supabase (PostgREST) que retornam
 * o estoque de variantes e serve um payload fixo. Garante que as specs
 * `stock-rupture-horizon*` rodem com os MESMOS dados em qualquer ambiente,
 * eliminando skips por empty-state e flakiness por seed.
 *
 * Cobre 3 cenários canônicos:
 *  - HEALTHY: estoque alto, baixa diária baixa  → low_stock=0 em 3d
 *  - AT_RISK_30D: estoque médio, baixa moderada → low_stock dispara só em 30d
 *  - MISSING_FIELDS: current/min/max indefinidos → fallback (não crasha)
 *
 * Uso:
 *   import { installRuptureFixture } from '../../fixtures/stock-rupture-fixture';
 *   await installRuptureFixture(page);
 *   await gotoAndSettle(page, '/estoque');
 *
 * Observação: o matcher de URL é heurístico (qualquer GET a
 * `/rest/v1/product_variants*` ou `/rest/v1/variant_stock*`). Se a tabela
 * canônica mudar de nome, ajustar a regex sem alterar a forma do payload.
 */
import type { Page } from '@playwright/test';

export interface FixtureRow {
  id: string;
  sku: string;
  name: string;
  current: number | null;
  min: number | null;
  max: number | null;
  avg_daily_depletion: number | null;
  supplier_name: string;
}

export const DEFAULT_RUPTURE_FIXTURE: FixtureRow[] = [
  // HEALTHY — projeção fica acima do alvo mesmo em 30d
  {
    id: 'fx-healthy-1',
    sku: 'FX-HEALTHY-001',
    name: '[FX] Caneta Saudável',
    current: 5000,
    min: 100,
    max: 8000,
    avg_daily_depletion: 5,
    supplier_name: 'FX Fornecedor A',
  },
  // AT_RISK_30D — current 800, baixa 20/dia
  //   3d  → 740 (≥ alvo 100) ok
  //   30d → 200 (≥ alvo 100) ainda ok; com alvo 500 dispara em 30d (300 < 500)
  {
    id: 'fx-risk-1',
    sku: 'FX-RISK-001',
    name: '[FX] Caneca Risco 30d',
    current: 800,
    min: 50,
    max: 1500,
    avg_daily_depletion: 20,
    supplier_name: 'FX Fornecedor B',
  },
  // MISSING_FIELDS — current/min/max nulos: fallback estático, sem crash
  {
    id: 'fx-missing-1',
    sku: 'FX-MISSING-001',
    name: '[FX] Mochila Sem Dados',
    current: null,
    min: null,
    max: null,
    avg_daily_depletion: null,
    supplier_name: 'FX Fornecedor C',
  },
];

export async function installRuptureFixture(
  page: Page,
  rows: FixtureRow[] = DEFAULT_RUPTURE_FIXTURE,
): Promise<void> {
  const payload = JSON.stringify(rows);

  await page.route(
    /\/rest\/v1\/(product_variants|variant_stock|stock_variants|gold_variant_stock)(\?|$)/,
    async (route) => {
      const req = route.request();
      if (req.method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'content-range': `0-${rows.length - 1}/${rows.length}`,
          'access-control-expose-headers': 'content-range',
        },
        body: payload,
      });
    },
  );

  // Sinaliza para o app (caso queira instrumentar) que estamos em modo fixture.
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__E2E_RUPTURE_FIXTURE__ = true;
  });
}

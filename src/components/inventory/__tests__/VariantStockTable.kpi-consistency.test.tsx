/**
 * Regressão SSOT — consistência entre KPI "Estoque Baixo" do
 * StockDashboard e o chip de status da VariantStockTable.
 *
 * Histórico do bug travado por este teste:
 *   - O KPI "Estoque Baixo" somava `productsLowStock + productsCritical`,
 *     mas o clique aplicava apenas `filters.status = 'low_stock'`.
 *     Resultado: o card mostrava N produtos, mas a tabela renderizava
 *     N − criticos depois do clique. Confundia o vendedor.
 *   - Os labels dos chips ('Risco de Ruptura', 'Esgotado') divergiam
 *     dos títulos dos cards ('Estoque Baixo', 'Sem Estoque').
 *
 * Invariantes verificadas (qualquer regressão FALHA o build):
 *   1. STATUS_FILTER_LABEL['low_stock']  === 'Estoque Baixo'
 *      → bate com o `title` do <StatCard title="Estoque Baixo" />.
 *   2. STATUS_FILTER_LABEL['out_of_stock'] === 'Sem Estoque'
 *      → bate com o <StatCard title="Sem Estoque" />.
 *   3. STATUS_FILTER_LABEL['critical']   === 'Crítico'
 *      → chip dedicado; KPI "Sem Estoque" complementa via trend.
 *   4. O KPI "Estoque Baixo" do dashboard renderiza EXATAMENTE
 *      `productsLowStock` (sem somar críticos) — assim o clique
 *      em "Estoque Baixo" (que aplica `status='low_stock'`) produz
 *      uma tabela com a mesma contagem.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const TABLE_SRC = readFileSync(
  resolve(ROOT, 'components/inventory/VariantStockTable.tsx'),
  'utf8',
);
const DASHBOARD_SRC = readFileSync(
  resolve(ROOT, 'components/inventory/StockDashboard.tsx'),
  'utf8',
);

describe('SSOT KPI ↔ chip de status', () => {
  it('chip "low_stock" usa o label "Estoque Baixo" (mesmo do StatCard)', () => {
    expect(TABLE_SRC).toMatch(/low_stock:\s*'Estoque Baixo'/);
    expect(DASHBOARD_SRC).toMatch(/title="Estoque Baixo"/);
  });

  it('chip "out_of_stock" usa o label "Sem Estoque" (mesmo do StatCard)', () => {
    expect(TABLE_SRC).toMatch(/out_of_stock:\s*'Sem Estoque'/);
    expect(DASHBOARD_SRC).toMatch(/title="Sem Estoque"/);
  });

  it('chip "critical" preserva o label "Crítico"', () => {
    expect(TABLE_SRC).toMatch(/critical:\s*'Crítico'/);
  });

  it('KPI "Estoque Baixo" usa SOMENTE productsLowStock (não soma críticos)', () => {
    // Aceita formato `summary.productsLowStock.toLocaleString(...)`.
    // BLOQUEIA qualquer regressão do tipo
    // `summary.productsLowStock + summary.productsCritical`.
    expect(DASHBOARD_SRC).toMatch(
      /value=\{summary\.productsLowStock\.toLocaleString\('pt-BR'\)\}/,
    );
    expect(DASHBOARD_SRC).not.toMatch(
      /value=\{\(summary\.productsLowStock\s*\+\s*summary\.productsCritical\)/,
    );
  });

  it('KPI "Estoque Baixo" só fica ativo quando filters.status === "low_stock"', () => {
    // Antes: `=== 'low_stock' || === 'critical'` → KPI ficava aceso
    // filtrando algo que não estava contando. Não pode voltar.
    expect(DASHBOARD_SRC).toMatch(
      /isActive=\{filters\.status === 'low_stock'\}/,
    );
    expect(DASHBOARD_SRC).not.toMatch(
      /filters\.status === 'low_stock'\s*\|\|\s*filters\.status === 'critical'/,
    );
  });
});

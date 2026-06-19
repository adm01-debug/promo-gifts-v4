/**
 * Regressão SSOT — consistência entre o KPI clicável do StockDashboard e o
 * chip de status da VariantStockTable.
 *
 * Histórico (mantido para contexto):
 *   - O KPI "Estoque Baixo" somava `productsLowStock + productsCritical` mas o
 *     clique aplicava só `low_stock` → card mostrava N, tabela renderizava
 *     N − críticos. Para evitar isso, o card passou a mostrar SÓ
 *     `productsLowStock`. Porém, com a régua por `min` descontinuada
 *     (calculateStockStatus nunca devolve 'low_stock'), `productsLowStock`
 *     ficou ESTRUTURALMENTE 0 — um KPI morto cujo clique filtrava vazio.
 *   - Correção (auditoria 2026-06-17): o card foi reaproveitado para "Crítico"
 *     (`productsCritical`, produtos parcialmente sem estoque,
 *     overallStatus==='critical'), com clique aplicando `status='critical'`.
 *     O filtro de produto já casa `overallStatus==='critical'`, então
 *     card-count == produtos-filtrados (invariante preservada).
 *
 * Invariantes (qualquer regressão FALHA o build):
 *   1. Chips da tabela preservam os labels: low_stock→'Estoque Baixo',
 *      out_of_stock→'Sem Estoque', critical→'Crítico'.
 *   2. O StatCard "Crítico" do dashboard renderiza EXATAMENTE
 *      `productsCritical` (sem somar low_stock) e fica ativo só quando
 *      `filters.status === 'critical'` — assim o clique produz uma tabela
 *      com a mesma contagem.
 *   3. O card morto "Estoque Baixo" (productsLowStock, sempre 0) NÃO volta.
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
  it('chip "low_stock" preserva o label "Estoque Baixo" na tabela', () => {
    expect(TABLE_SRC).toMatch(/low_stock:\s*'Estoque Baixo'/);
  });

  it('chip "out_of_stock" usa o label "Sem Estoque" (mesmo do StatCard)', () => {
    expect(TABLE_SRC).toMatch(/out_of_stock:\s*'Sem Estoque'/);
    expect(DASHBOARD_SRC).toMatch(/title="Sem Estoque"/);
  });

  it('chip "critical" usa o label "Crítico" (mesmo do StatCard)', () => {
    expect(TABLE_SRC).toMatch(/critical:\s*'Crítico'/);
    expect(DASHBOARD_SRC).toMatch(/title="Crítico"/);
  });

  it('KPI "Crítico" usa SOMENTE productsCritical (não soma low_stock)', () => {
    expect(DASHBOARD_SRC).toMatch(
      /value=\{summary\.productsCritical\.toLocaleString\('pt-BR'\)\}/,
    );
    expect(DASHBOARD_SRC).not.toMatch(
      /value=\{\(summary\.productsCritical\s*\+\s*summary\.productsLowStock\)/,
    );
  });

  it('KPI "Crítico" só fica ativo quando filters.status === "critical"', () => {
    expect(DASHBOARD_SRC).toMatch(/isActive=\{filters\.status === 'critical'\}/);
    expect(DASHBOARD_SRC).not.toMatch(
      /filters\.status === 'critical'\s*\|\|\s*filters\.status === 'low_stock'/,
    );
  });

  it('o card morto "Estoque Baixo" (productsLowStock, sempre 0) não volta', () => {
    expect(DASHBOARD_SRC).not.toMatch(/title="Estoque Baixo"/);
    expect(DASHBOARD_SRC).not.toMatch(
      /value=\{summary\.productsLowStock\.toLocaleString\('pt-BR'\)\}/,
    );
  });
});

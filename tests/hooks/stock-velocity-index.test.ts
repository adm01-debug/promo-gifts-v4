/**
 * buildVelocityIndex — índice de baixa diária real (mv_stock_velocity) por
 * variação, que alimenta `VariantStock.avgDailySales` e, por consequência, o
 * Risco de Ruptura preditivo e os dias-até-esgotar.
 *
 * Antes desta fonte real, avgDailySales NUNCA era populado → o recurso
 * preditivo ficava inerte em produção (auditoria F4).
 */
import { describe, it, expect } from 'vitest';
import {
  buildVelocityIndex,
  type ExternalStockVelocity,
} from '@/hooks/stock/stockFetcher';
import { computeRuptureRisk } from '@/lib/inventory/rupture-risk';

const row = (over: Partial<ExternalStockVelocity>): ExternalStockVelocity => ({
  id: crypto.randomUUID(),
  variant_id: 'v1',
  avg_daily_depletion_7d: null,
  avg_daily_depletion_30d: null,
  ...over,
});

describe('buildVelocityIndex', () => {
  it('prioriza a baixa de 30 dias quando disponível', () => {
    const idx = buildVelocityIndex([
      row({ variant_id: 'v1', avg_daily_depletion_30d: 12.5, avg_daily_depletion_7d: 99 }),
    ]);
    expect(idx.get('v1')).toBe(12.5);
  });

  it('cai para 7 dias quando 30d é 0/nulo (variação recém-criada)', () => {
    const idx = buildVelocityIndex([
      row({ variant_id: 'v1', avg_daily_depletion_30d: 0, avg_daily_depletion_7d: 8 }),
      row({ variant_id: 'v2', avg_daily_depletion_30d: null, avg_daily_depletion_7d: 3 }),
    ]);
    expect(idx.get('v1')).toBe(8);
    expect(idx.get('v2')).toBe(3);
  });

  it('ignora valores ≤ 0, nulos e não-finitos (ausência de sinal)', () => {
    const idx = buildVelocityIndex([
      row({ variant_id: 'v1', avg_daily_depletion_30d: 0, avg_daily_depletion_7d: 0 }),
      row({ variant_id: 'v2', avg_daily_depletion_30d: -5, avg_daily_depletion_7d: -1 }),
      row({ variant_id: 'v3', avg_daily_depletion_30d: Number.NaN, avg_daily_depletion_7d: null }),
    ]);
    expect(idx.has('v1')).toBe(false);
    expect(idx.has('v2')).toBe(false);
    expect(idx.has('v3')).toBe(false);
    expect(idx.size).toBe(0);
  });

  it('com múltiplos sources por variação, mantém a MAIOR baixa (conservador)', () => {
    const idx = buildVelocityIndex([
      row({ variant_id: 'v1', avg_daily_depletion_30d: 4 }),
      row({ variant_id: 'v1', avg_daily_depletion_30d: 20 }),
      row({ variant_id: 'v1', avg_daily_depletion_30d: 9 }),
    ]);
    expect(idx.get('v1')).toBe(20);
  });

  it('ignora linhas sem variant_id', () => {
    const idx = buildVelocityIndex([
      row({ variant_id: null, avg_daily_depletion_30d: 50 }),
      row({ variant_id: '', avg_daily_depletion_30d: 50 }),
    ]);
    expect(idx.size).toBe(0);
  });

  it('lista vazia → mapa vazio', () => {
    expect(buildVelocityIndex([]).size).toBe(0);
  });
});

describe('F4 — velocidade real ativa o Risco de Ruptura (antes inerte)', () => {
  it('SKU saudável vira at-risk quando a baixa real é alta o bastante', () => {
    // 90 un, alvo 100, horizonte 7d. Sem velocidade (estado antigo): avgDaily
    // ausente → atRisk:false (recurso inerte). Com a baixa real de 5/dia:
    // projeção = 90 − 5×7 = 55 < 100 → at-risk.
    const idx = buildVelocityIndex([
      { id: 's1', variant_id: 'v1', avg_daily_depletion_30d: 5, avg_daily_depletion_7d: 4 },
    ]);
    const avgDaily = idx.get('v1');

    const inert = computeRuptureRisk({
      current: 90,
      avgDailyDepletion: undefined, // estado de produção ANTES do F4
      targetQty: 100,
      horizonDays: 7,
    });
    expect(inert.atRisk).toBe(false);

    const active = computeRuptureRisk({
      current: 90,
      avgDailyDepletion: avgDaily, // agora populado pela fonte real
      targetQty: 100,
      horizonDays: 7,
    });
    expect(active.atRisk).toBe(true);
    expect(active.projectedStock).toBe(55);
  });

  it('baixa real baixa NÃO gera falso positivo de ruptura', () => {
    const idx = buildVelocityIndex([
      { id: 's2', variant_id: 'v9', avg_daily_depletion_30d: 0.5, avg_daily_depletion_7d: null },
    ]);
    const risk = computeRuptureRisk({
      current: 500,
      avgDailyDepletion: idx.get('v9'),
      targetQty: 100,
      horizonDays: 7,
    });
    // 500 − 0.5×7 = 496.5 → 497 ≥ 100 → sem risco.
    expect(risk.atRisk).toBe(false);
  });
});

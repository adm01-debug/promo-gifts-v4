/**
 * Fuzz / propriedade — cobertura em dias e classificação de faixa.
 *
 * Cobre cenários extremos (Infinity, NaN, negativos, zero vendas, arredondamento)
 * e gera ~600 simulações pseudo-aleatórias. Ao final escreve um relatório em
 * `tests-quality-report-days-cover.json` (raiz do projeto) com estatísticas
 * por faixa para revisão rápida em CI.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateDaysUntilStockout } from '@/types/stock';
import { getDaysCoverBand, type DaysCoverBand } from '@/lib/inventory/health-score';

interface CaseResult {
  stock: number;
  avg: number;
  days: number | undefined;
  band: DaysCoverBand;
}

const results: CaseResult[] = [];

function run(stock: number, avg: number): CaseResult {
  const days = calculateDaysUntilStockout(stock, avg);
  const band = getDaysCoverBand(days);
  results.push({ stock, avg, days, band });
  return { stock, avg, days, band };
}

describe('cobertura em dias — casos extremos', () => {
  it.each([
    [0, 5],
    [-1, 5],
    [-9999, 5],
    [100, 0],
    [100, -1],
    [Number.NaN, 5],
    [100, Number.NaN],
    [Number.POSITIVE_INFINITY, 5],
    [100, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, 5],
  ])('stock=%s avg=%s → undefined + danger', (stock, avg) => {
    const r = run(stock, avg);
    expect(r.days).toBeUndefined();
    expect(r.band).toBe('danger');
  });

  it('arredonda com Math.floor (29.9 → 29 → warning)', () => {
    const r = run(299, 10);
    expect(r.days).toBe(29);
    expect(r.band).toBe('warning');
  });

  it('thresholds exatos: 7 → warning, 6 → danger, 30 → good, 29 → warning', () => {
    expect(run(7, 1).band).toBe('warning');
    expect(run(6, 1).band).toBe('danger');
    expect(run(30, 1).band).toBe('good');
    expect(run(29, 1).band).toBe('warning');
  });
});

describe('cobertura em dias — fuzz 600x', () => {
  it('sempre retorna número finito ≥0 ou undefined; faixa consistente', () => {
    // PRNG determinístico (mulberry32) para reprodutibilidade em CI.
    let seed = 0xc0ffee;
    const rand = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let i = 0; i < 600; i++) {
      const stock = Math.floor(rand() * 10_000) - 50; // -50..9949 (inclui negativos)
      const avg = rand() < 0.05 ? 0 : rand() * 50; // 5% com avg=0
      const r = run(stock, avg);
      if (r.days !== undefined) {
        expect(Number.isFinite(r.days)).toBe(true);
        expect(r.days).toBeGreaterThanOrEqual(0);
        // Coerência entre faixa e valor.
        if (r.days >= 30) expect(r.band).toBe('good');
        else if (r.days >= 7) expect(r.band).toBe('warning');
        else expect(r.band).toBe('danger');
      } else {
        expect(r.band).toBe('danger');
      }
    }
  });
});

afterAll(() => {
  const counts: Record<DaysCoverBand, number> = { good: 0, warning: 0, danger: 0 };
  let undef = 0;
  let maxDays = 0;
  for (const r of results) {
    counts[r.band]++;
    if (r.days === undefined) undef++;
    else if (r.days > maxDays) maxDays = r.days;
  }
  const report = {
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    bandCounts: counts,
    undefinedDays: undef,
    maxDays,
    thresholds: { good: '≥30d', warning: '7–29d', danger: '<7d ou indefinido' },
  };
  try {
    writeFileSync(
      resolve(process.cwd(), 'tests-quality-report-days-cover.json'),
      JSON.stringify(report, null, 2),
    );
  } catch {
    // Sandbox somente leitura — ignora.
  }
});

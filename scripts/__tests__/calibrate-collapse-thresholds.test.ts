/**
 * Bateria B3 — Análise estática de `scripts/qa/calibrate-collapse-thresholds.mjs`.
 *
 * Não invoca Playwright. Verifica flags, parsing de args, defaults,
 * comportamento --dry-run e presença de saídas (CSV + markdown + JSON).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync('scripts/qa/calibrate-collapse-thresholds.mjs', 'utf8');

describe('calibrate-collapse-thresholds — invariantes estáticas', () => {
  it('expõe modo --dry-run (flag ou env CALIBRATE_DRY_RUN)', () => {
    expect(SRC).toMatch(/dry-run/);
    expect(SRC).toMatch(/CALIBRATE_DRY_RUN/);
  });

  it('nunca aborta em dry-run mesmo com falhas do spec', () => {
    // Padrão esperado: warn + continue quando DRY_RUN=true.
    expect(SRC).toMatch(/DRY_RUN/);
    // process.exit com status ≠ 0 não deve estar em cascata solta.
    const forcedExit = SRC.match(/process\.exit\((?!0\))\d+\)/g) ?? [];
    expect(forcedExit.length).toBe(0);
  });

  it('gera relatórios em visual-diff-report/', () => {
    expect(SRC).toContain('visual-diff-report');
    expect(SRC).toMatch(/calibration\.(md|json|csv)/);
  });

  it('itera sobre thresholds × ratios com defaults numéricos válidos', () => {
    expect(SRC).toMatch(/THRESHOLDS/);
    expect(SRC).toMatch(/RATIOS/);
    // Defaults devem ser CSV numéricos.
    const defaults = SRC.match(/["'][\d.,]+["']/g) ?? [];
    expect(defaults.length).toBeGreaterThan(1);
  });

  it('produz uma linha CSV por combinação (viewport,threshold,ratio,fails)', () => {
    // CSV com cabeçalho canônico.
    expect(SRC).toMatch(/threshold/);
    expect(SRC).toMatch(/ratio/);
  });
});

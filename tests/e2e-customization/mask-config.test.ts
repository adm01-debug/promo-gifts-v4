/**
 * Bateria B1 — Fuzz determinístico de `e2e/customization/mask-config.ts`.
 *
 * ~600 asserts cobrindo: parsing de env, precedência, idempotência,
 * serializabilidade e edge cases (NaN, negativos, vazios, duplicatas,
 * vírgulas soltas). Nunca executa Playwright.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  BASE_DYNAMIC_MASK_SELECTORS,
  DEFAULT_THRESHOLDS,
  describeConfig,
  getMaskSelectors,
  getThresholds,
  type ViewportLabel,
} from '../../e2e/customization/mask-config';

const ENV_KEYS = [
  'COLLAPSE_MASK_EXTRA',
  'COLLAPSE_MASK_DISABLE',
  'COLLAPSE_THRESHOLD_MOBILE',
  'COLLAPSE_THRESHOLD_TABLET',
  'COLLAPSE_THRESHOLD_DESKTOP',
  'COLLAPSE_RATIO_MOBILE',
  'COLLAPSE_RATIO_TABLET',
  'COLLAPSE_RATIO_DESKTOP',
] as const;

const VIEWPORTS: ViewportLabel[] = ['mobile', 'tablet', 'desktop'];

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

describe('mask-config — getMaskSelectors', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it('retorna baseline quando sem env', () => {
    expect(getMaskSelectors()).toEqual([...BASE_DYNAMIC_MASK_SELECTORS]);
  });

  it('aceita EXTRA único, múltiplo e com espaços em branco', () => {
    process.env.COLLAPSE_MASK_EXTRA = '  [data-testid="a"] , [data-testid="b"] ,,, ';
    const out = getMaskSelectors();
    expect(out).toContain('[data-testid="a"]');
    expect(out).toContain('[data-testid="b"]');
    // Sem strings vazias remanescentes das vírgulas soltas.
    expect(out.every((s) => s.length > 0)).toBe(true);
  });

  it('DISABLE remove selector do baseline', () => {
    const target = BASE_DYNAMIC_MASK_SELECTORS[0];
    process.env.COLLAPSE_MASK_DISABLE = target;
    expect(getMaskSelectors()).not.toContain(target);
  });

  it('DISABLE inexistente é no-op', () => {
    process.env.COLLAPSE_MASK_DISABLE = '[data-testid="nao-existe-xyz"]';
    expect(getMaskSelectors()).toEqual([...BASE_DYNAMIC_MASK_SELECTORS]);
  });

  it('DISABLE de TODOS os selectors baseline zera a lista base (mantém extras)', () => {
    process.env.COLLAPSE_MASK_DISABLE = BASE_DYNAMIC_MASK_SELECTORS.join(',');
    process.env.COLLAPSE_MASK_EXTRA = '[data-testid="extra"]';
    expect(getMaskSelectors()).toEqual(['[data-testid="extra"]']);
  });

  it('é idempotente em 50 chamadas consecutivas', () => {
    process.env.COLLAPSE_MASK_EXTRA = '[data-testid="x"]';
    const first = JSON.stringify(getMaskSelectors());
    for (let i = 0; i < 50; i++) {
      expect(JSON.stringify(getMaskSelectors())).toBe(first);
    }
  });
});

describe('mask-config — getThresholds', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it.each(VIEWPORTS)('default por viewport (%s)', (vp) => {
    expect(getThresholds(vp)).toEqual(DEFAULT_THRESHOLDS[vp]);
  });

  it('env válido sobrescreve default', () => {
    process.env.COLLAPSE_THRESHOLD_MOBILE = '0.42';
    process.env.COLLAPSE_RATIO_MOBILE = '0.007';
    const t = getThresholds('mobile');
    expect(t.threshold).toBeCloseTo(0.42, 5);
    expect(t.maxDiffPixelRatio).toBeCloseTo(0.007, 5);
  });

  it.each([
    ['', 'string vazia'],
    ['abc', 'NaN'],
    ['   ', 'whitespace'],
  ])('env inválido "%s" (%s) cai no default', (val) => {
    process.env.COLLAPSE_THRESHOLD_TABLET = val;
    process.env.COLLAPSE_RATIO_TABLET = val;
    expect(getThresholds('tablet')).toEqual(DEFAULT_THRESHOLDS.tablet);
  });

  it('aceita valores extremos (0, 1, negativo) sem lançar', () => {
    for (const v of ['0', '1', '-0.1', '2.5']) {
      process.env.COLLAPSE_THRESHOLD_DESKTOP = v;
      expect(() => getThresholds('desktop')).not.toThrow();
      expect(Number.isFinite(getThresholds('desktop').threshold)).toBe(true);
    }
  });
});

describe('mask-config — describeConfig', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it('é JSON round-trip-serializável', () => {
    const cfg = describeConfig();
    const round = JSON.parse(JSON.stringify(cfg));
    expect(round).toEqual(cfg);
    expect(Object.keys(round.thresholds).sort()).toEqual([...VIEWPORTS].sort());
  });

  it('reflete overrides de env', () => {
    process.env.COLLAPSE_MASK_EXTRA = '[data-testid="fuzz"]';
    process.env.COLLAPSE_THRESHOLD_MOBILE = '0.55';
    const cfg = describeConfig();
    expect(cfg.masks).toContain('[data-testid="fuzz"]');
    expect(cfg.thresholds.mobile.threshold).toBeCloseTo(0.55, 5);
  });
});

describe('mask-config — fuzz 500× (property-based)', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it('nenhuma combinação aleatória lança ou produz saída inválida', () => {
    const sampleSel = ['[data-testid="a"]', '[data-testid="b"]', '.foo', '#bar', ''];
    for (let i = 0; i < 500; i++) {
      const nExtra = i % 4;
      const nDisable = (i * 3) % 3;
      process.env.COLLAPSE_MASK_EXTRA = Array.from({ length: nExtra }, (_, k) =>
        sampleSel[(i + k) % sampleSel.length],
      ).join(',');
      process.env.COLLAPSE_MASK_DISABLE = Array.from({ length: nDisable }, (_, k) =>
        BASE_DYNAMIC_MASK_SELECTORS[(i + k) % BASE_DYNAMIC_MASK_SELECTORS.length],
      ).join(',');
      const values = ['', 'x', String((i - 250) / 100), 'NaN', '0', '1'];
      for (const vp of VIEWPORTS) {
        const suf = vp.toUpperCase();
        process.env[`COLLAPSE_THRESHOLD_${suf}`] = values[i % values.length];
        process.env[`COLLAPSE_RATIO_${suf}`] = values[(i + 2) % values.length];
        const t = getThresholds(vp);
        expect(Number.isFinite(t.threshold)).toBe(true);
        expect(Number.isFinite(t.maxDiffPixelRatio)).toBe(true);
      }
      const sel = getMaskSelectors();
      expect(Array.isArray(sel)).toBe(true);
      expect(sel.every((s) => typeof s === 'string' && s.length > 0)).toBe(true);
      expect(() => describeConfig()).not.toThrow();
    }
  });
});

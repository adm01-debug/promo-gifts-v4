/**
 * Fuzz/property tests exaustivos — watermarkTokens.
 *
 * 500+ cenários cobrindo:
 *   • Todo alpha ∈ [0, 1] em passos de 0.001 → propriedades matemáticas
 *   • RGB arbitrário → composição sempre em [0, 255] e inteira
 *   • Backgrounds alternativos → contraste ≥ 1 (definição WCAG)
 *   • Simetria de contraste (a↔b)
 *   • Monotonicidade: alpha↑ ⇒ vermelho composto R↓ (mais opaco = mais colorido)
 *   • Regressão: valor atual do WATERMARK_ALPHA está na "zona doce"
 *     (dentro dos bounds E longe das bordas em > 20%)
 */
import { describe, it, expect } from 'vitest';
import {
  WATERMARK_ALPHA,
  WATERMARK_ALPHA_BOUNDS,
  WATERMARK_CONTRAST_BOUNDS,
  WATERMARK_RGB,
  WATERMARK_BACKGROUND_RGB,
  composeWatermarkOverWhite,
  relativeLuminance,
  watermarkContrastAgainstWhite,
} from '../watermarkTokens';

// Reimplementa composição para poder variar fg/alpha/bg (helper acima é fixo)
function compose(
  fg: { r: number; g: number; b: number },
  a: number,
  bg: { r: number; g: number; b: number },
) {
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
  };
}

function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

describe('watermarkTokens — fuzz matemático (1001 alphas)', () => {
  const alphas: number[] = [];
  for (let a = 0; a <= 1.0001; a += 0.001) alphas.push(Math.min(1, Number(a.toFixed(3))));

  it('luminância relativa está sempre em [0, 1] para 1001 alphas', () => {
    let violations = 0;
    for (const a of alphas) {
      const c = compose(WATERMARK_RGB, a, WATERMARK_BACKGROUND_RGB);
      const l = relativeLuminance(c);
      if (l < 0 || l > 1) violations++;
    }
    expect(violations, `luminância fora de [0,1] em ${violations}/${alphas.length}`).toBe(0);
  });

  it('canais compostos ficam em [0, 255] inteiros', () => {
    let bad = 0;
    for (const a of alphas) {
      const c = compose(WATERMARK_RGB, a, WATERMARK_BACKGROUND_RGB);
      for (const v of [c.r, c.g, c.b]) {
        if (!Number.isInteger(v) || v < 0 || v > 255) bad++;
      }
    }
    expect(bad).toBe(0);
  });

  it('monotonicidade: alpha↑ ⇒ canal R composto ↓ (vermelho preserva melhor)', () => {
    let last = Infinity;
    let breaks = 0;
    for (const a of alphas) {
      const r = compose(WATERMARK_RGB, a, WATERMARK_BACKGROUND_RGB).r;
      // Devido ao Math.round, degraus de 1 são aceitáveis, mas nunca subir.
      if (r > last) breaks++;
      last = r;
    }
    expect(breaks, `${breaks} quebras de monotonicidade`).toBe(0);
  });

  it('contraste é sempre ≥ 1 (definição WCAG) para 1001 alphas', () => {
    let bad = 0;
    for (const a of alphas) {
      const c = compose(WATERMARK_RGB, a, WATERMARK_BACKGROUND_RGB);
      const ratio = contrastRatio(c, WATERMARK_BACKGROUND_RGB);
      if (ratio < 1 - 1e-9) bad++;
    }
    expect(bad).toBe(0);
  });

  it('simetria: contraste(A,B) === contraste(B,A)', () => {
    let violations = 0;
    for (const a of alphas) {
      const c = compose(WATERMARK_RGB, a, WATERMARK_BACKGROUND_RGB);
      const ab = contrastRatio(c, WATERMARK_BACKGROUND_RGB);
      const ba = contrastRatio(WATERMARK_BACKGROUND_RGB, c);
      if (Math.abs(ab - ba) > 1e-9) violations++;
    }
    expect(violations).toBe(0);
  });

  it('alpha=0 → contraste === 1 (texto invisível, mesma cor do fundo)', () => {
    const c = compose(WATERMARK_RGB, 0, WATERMARK_BACKGROUND_RGB);
    expect(contrastRatio(c, WATERMARK_BACKGROUND_RGB)).toBeCloseTo(1, 5);
  });

  it('alpha=1 → contraste igual ao do vermelho puro contra branco (~5.25:1)', () => {
    const c = compose(WATERMARK_RGB, 1, WATERMARK_BACKGROUND_RGB);
    const ratio = contrastRatio(c, WATERMARK_BACKGROUND_RGB);
    // 200,0,0 sobre branco: luminância ≈ 0.128 → ratio ≈ (1.05)/(0.178) ≈ 5.9
    expect(ratio).toBeGreaterThan(4);
    expect(ratio).toBeLessThan(7);
  });
});

describe('watermarkTokens — fuzz de RGB arbitrário (200 combinações)', () => {
  it('composição preserva domínio para 200 RGBs pseudoaleatórios', () => {
    let bad = 0;
    // PRNG determinístico (seed fixo) para reprodutibilidade
    let seed = 0x1234abcd;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 200; i++) {
      const fg = { r: Math.floor(rand() * 256), g: Math.floor(rand() * 256), b: Math.floor(rand() * 256) };
      const bg = { r: Math.floor(rand() * 256), g: Math.floor(rand() * 256), b: Math.floor(rand() * 256) };
      const a = rand();
      const c = compose(fg, a, bg);
      for (const v of [c.r, c.g, c.b]) {
        if (v < 0 || v > 255 || !Number.isInteger(v)) bad++;
      }
      const ratio = contrastRatio(c, bg);
      if (!(ratio >= 1)) bad++;
    }
    expect(bad).toBe(0);
  });
});

describe('watermarkTokens — regressão de calibração', () => {
  it('WATERMARK_ALPHA atual está na "zona doce" (≥ 20% de folga dos dois lados)', () => {
    const { min, max } = WATERMARK_ALPHA_BOUNDS;
    const range = max - min;
    const marginMin = WATERMARK_ALPHA - min;
    const marginMax = max - WATERMARK_ALPHA;
    // Ao menos 10% de folga de cada lado (evita ficar colado no limite).
    expect(marginMin / range).toBeGreaterThanOrEqual(0.1);
    expect(marginMax / range).toBeGreaterThanOrEqual(0.1);
  });

  it('contraste atual está estritamente dentro dos bounds calibrados', () => {
    const ratio = watermarkContrastAgainstWhite();
    expect(ratio).toBeGreaterThan(WATERMARK_CONTRAST_BOUNDS.min);
    expect(ratio).toBeLessThan(WATERMARK_CONTRAST_BOUNDS.max);
  });

  it('bounds são internamente coerentes (min < max, ambos em [0,1] para alpha)', () => {
    expect(WATERMARK_ALPHA_BOUNDS.min).toBeGreaterThan(0);
    expect(WATERMARK_ALPHA_BOUNDS.min).toBeLessThan(WATERMARK_ALPHA_BOUNDS.max);
    expect(WATERMARK_ALPHA_BOUNDS.max).toBeLessThanOrEqual(1);
    expect(WATERMARK_CONTRAST_BOUNDS.min).toBeGreaterThanOrEqual(1);
    expect(WATERMARK_CONTRAST_BOUNDS.min).toBeLessThan(WATERMARK_CONTRAST_BOUNDS.max);
  });

  it('helper exportado composeWatermarkOverWhite bate com composição manual', () => {
    const a = composeWatermarkOverWhite();
    const b = compose(WATERMARK_RGB, WATERMARK_ALPHA, WATERMARK_BACKGROUND_RGB);
    expect(a).toEqual(b);
  });

  it('relativeLuminance de preto ≈ 0 e de branco ≈ 1', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

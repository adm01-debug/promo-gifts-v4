import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio, isHex6, swatchBorderColor } from '@/utils/colorContrast';

describe('colorContrast (#9 — swatch WCAG)', () => {
  it('relativeLuminance: preto aprox 0, branco aprox 1', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 4);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 4);
  });
  it('contrastRatio: preto x branco = 21:1; igual = 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
  it('isHex6 valida apenas #RRGGBB', () => {
    expect(isHex6('#abcdef')).toBe(true);
    expect(isHex6('#ABC123')).toBe(true);
    expect(isHex6('#abc')).toBe(false);
    expect(isHex6('abcdef')).toBe(false);
    expect(isHex6('#xyz123')).toBe(false);
    expect(isHex6(null)).toBe(false);
    expect(isHex6(undefined)).toBe(false);
    expect(isHex6('')).toBe(false);
  });
  it('swatchBorderColor: cor clara (<3:1 com branco) recebe borda forte; senao sutil', () => {
    for (const light of ['#ffffff', '#fffacd', '#e0e0e0', '#c0c0c0']) {
      expect(swatchBorderColor(light)).toBe('#767676');
    }
    for (const dark of ['#808080', '#ff0000', '#0000ff', '#000000']) {
      expect(swatchBorderColor(dark)).toBe('rgba(0,0,0,0.25)');
    }
  });
  it('a borda forte e ela mesma visivel no branco (>=3:1)', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(3);
  });
  it('perceptibilidade universal: varredura de cores — todo swatch e perceptivel no branco', () => {
    const hx = (n: number) => n.toString(16).padStart(2, '0');
    let violations = 0;
    for (let r = 0; r <= 255; r += 51)
      for (let g = 0; g <= 255; g += 51)
        for (let b = 0; b <= 255; b += 51) {
          const hex = `#${hx(r)}${hx(g)}${hx(b)}`;
          const fillVsWhite = contrastRatio(hex, '#ffffff');
          const strong = swatchBorderColor(hex) === '#767676';
          if (!(fillVsWhite >= 3 || strong)) violations++;
        }
    expect(violations).toBe(0);
  });
});

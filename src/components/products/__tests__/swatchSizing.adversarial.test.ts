/**
 * Hardening do SSOT de dimensionamento (swatchSizing). Blinda contra regressões
 * (incl. do bot Lovable) que poderiam quebrar a lógica de fallback ou os
 * mapeamentos de densidade. O contrato: o output é SEMPRE
 * `var(--swatch-size-<token válido>)`, nunca undefined, para qualquer input.
 */
import { describe, it, expect } from 'vitest';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import {
  resolveSwatchSizeToken,
  swatchSizeCssValue,
  swatchSizeStyle,
  SWATCH_SIZE_VAR,
} from '@/components/products/swatchSizing';

const VALID = new Set(['lg', 'md', 'sm', 'xs', 'xxs']);
// valores propositalmente fora de ColumnCount, para exercitar o fallback
const WEIRD: unknown[] = [
  undefined, null, 0, -1, 1, 2, 7, 9, 10, 99, 999, NaN, Infinity, 3.5, '5', '3', {}, [], true,
];
const asCol = (v: unknown) => v as ColumnCount;

describe('swatchSizing — robustez a inputs adversariais (hardening)', () => {
  it('grid: qualquer densidade estranha → token válido (default sm)', () => {
    for (const c of WEIRD) {
      expect(VALID.has(resolveSwatchSizeToken('grid', asCol(c)))).toBe(true);
    }
  });

  it('table SEMPRE xxs e list SEMPRE xs, independentemente de columns', () => {
    for (const c of WEIRD) {
      expect(resolveSwatchSizeToken('table', asCol(c))).toBe('xxs');
      expect(resolveSwatchSizeToken('list', asCol(c))).toBe('xs');
    }
  });

  it('densidades válidas mapeiam exatamente (3→lg,4→md,5→sm,6→xs,8→xxs)', () => {
    expect(resolveSwatchSizeToken('grid', 3)).toBe('lg');
    expect(resolveSwatchSizeToken('grid', 4)).toBe('md');
    expect(resolveSwatchSizeToken('grid', 5)).toBe('sm');
    expect(resolveSwatchSizeToken('grid', 6)).toBe('xs');
    expect(resolveSwatchSizeToken('grid', 8)).toBe('xxs');
  });

  it('swatchSizeCssValue sempre emite var(--swatch-size-<token válido>)', () => {
    for (const vm of ['grid', 'list', 'table'] as const) {
      for (const c of WEIRD) {
        expect(swatchSizeCssValue(vm, asCol(c))).toMatch(
          /^var\(--swatch-size-(lg|md|sm|xs|xxs)\)$/,
        );
      }
    }
  });

  it('swatchSizeStyle sempre seta a var (nunca undefined/vazio)', () => {
    const st = swatchSizeStyle('grid', 8) as Record<string, string>;
    expect(st[SWATCH_SIZE_VAR]).toBe('var(--swatch-size-xxs)');
    for (const vm of ['grid', 'list', 'table'] as const) {
      for (const c of WEIRD) {
        const s = swatchSizeStyle(vm, asCol(c)) as Record<string, string>;
        expect(s[SWATCH_SIZE_VAR]).toBeTruthy();
      }
    }
  });
});

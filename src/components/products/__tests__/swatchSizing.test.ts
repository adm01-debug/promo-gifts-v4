/**
 * Trava do dimensionamento PROPORCIONAL das bolinhas por visualização.
 * Regra do PO: Grid largo (poucas colunas) => maior; Grid denso => menor;
 * Lista => menor; Tabela => menor ainda.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveSwatchSizeToken,
  swatchSizeCssValue,
  swatchSizeStyle,
  SWATCH_SIZE_VAR,
  type SwatchSizeToken,
} from '@/components/products/swatchSizing';
import type { ColumnCount } from '@/components/products/ColumnSelector';

// px de cada token (espelha src/index.css) — usado só para checar a ORDEM.
const PX: Record<SwatchSizeToken, number> = { xxs: 16, xs: 20, sm: 24.2, md: 28.6, lg: 32 };

describe('resolveSwatchSizeToken — mapa por modo/densidade', () => {
  it('Grid escala pela densidade: 3→lg, 4→md, 5→sm, 6→xs, 8→xxs', () => {
    expect(resolveSwatchSizeToken('grid', 3)).toBe('lg');
    expect(resolveSwatchSizeToken('grid', 4)).toBe('md');
    expect(resolveSwatchSizeToken('grid', 5)).toBe('sm');
    expect(resolveSwatchSizeToken('grid', 6)).toBe('xs');
    expect(resolveSwatchSizeToken('grid', 8)).toBe('xxs');
  });

  it('Lista → xs (menor que o Grid padrão)', () => {
    expect(resolveSwatchSizeToken('list')).toBe('xs');
    // independe da densidade
    for (const c of [3, 4, 5, 6, 8] as ColumnCount[]) {
      expect(resolveSwatchSizeToken('list', c)).toBe('xs');
    }
  });

  it('Tabela → xxs (a menor de todas)', () => {
    expect(resolveSwatchSizeToken('table')).toBe('xxs');
    for (const c of [3, 4, 5, 6, 8] as ColumnCount[]) {
      expect(resolveSwatchSizeToken('table', c)).toBe('xxs');
    }
  });

  it('Grid sem densidade conhecida → sm (default seguro)', () => {
    expect(resolveSwatchSizeToken('grid')).toBe('sm');
    expect(resolveSwatchSizeToken('grid', 99 as unknown as ColumnCount)).toBe('sm');
  });
});

describe('ordem proporcional (monotonicidade)', () => {
  it('Grid 3 > 4 > 5 > 6 > 8 em px', () => {
    const seq = ([3, 4, 5, 6, 8] as ColumnCount[]).map(
      (c) => PX[resolveSwatchSizeToken('grid', c)],
    );
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeLessThan(seq[i - 1]);
  });

  it('Tabela ≤ Lista < Grid-3 (tabela é a menor; grid largo a maior)', () => {
    const table = PX[resolveSwatchSizeToken('table')];
    const list = PX[resolveSwatchSizeToken('list')];
    const grid3 = PX[resolveSwatchSizeToken('grid', 3)];
    expect(table).toBeLessThanOrEqual(list);
    expect(list).toBeLessThan(grid3);
    expect(table).toBeLessThan(grid3);
  });
});

describe('emissão de CSS', () => {
  it('swatchSizeCssValue → var(--swatch-size-<token>)', () => {
    expect(swatchSizeCssValue('grid', 3)).toBe('var(--swatch-size-lg)');
    expect(swatchSizeCssValue('grid', 8)).toBe('var(--swatch-size-xxs)');
    expect(swatchSizeCssValue('table')).toBe('var(--swatch-size-xxs)');
    expect(swatchSizeCssValue('list')).toBe('var(--swatch-size-xs)');
  });

  it('swatchSizeStyle seta a var --swatch-size', () => {
    const style = swatchSizeStyle('grid', 4) as Record<string, string>;
    expect(style[SWATCH_SIZE_VAR]).toBe('var(--swatch-size-md)');
    expect(SWATCH_SIZE_VAR).toBe('--swatch-size');
  });
});

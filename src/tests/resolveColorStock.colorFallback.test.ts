import { describe, it, expect } from 'vitest';
import { resolveColorStock } from '@/utils/color-image-resolver';
import { getCatalogStockStatus } from '@/lib/catalog-stock-status';

// PRNG determinístico (mulberry32) — sem dependências, reprodutível.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    const b = t + Math.imul(t ^ (t >>> 7), 61 | t);
    t ^= b;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type OColor = { name?: string; hex?: string; group?: string; stock?: number };
type OVar = { color?: { name?: string }; stock?: number | null };
type OProduct = { variations?: OVar[]; colors?: OColor[] };
type Resolved = { stock: number; stockStatus: string } | undefined;

const NAMES = ['Azul', 'Vermelho', 'Verde', 'Preto', 'Branco', 'Amarelo'];
const STOCKS: Array<number | undefined> = [undefined, -7, -1, 0, 1, 5, 9, 10, 11, 50, 9999];

// Atalho tipado: isola as duas vias de specificColorName (activeColors = null).
function rc(product: OProduct, scn: string | null): Resolved {
  return resolveColorStock(product as Parameters<typeof resolveColorStock>[0], null, scn) as Resolved;
}

// Oracle: replica a precedência documentada de resolveColorStock (activeColors=null).
function oracle(product: OProduct, scn: string | null): Resolved {
  if (scn && product.variations?.length) {
    const v = product.variations.find(
      (x: OVar) => x.color?.name?.toLowerCase() === String(scn).toLowerCase(),
    );
    if (v) {
      const s = v.stock ?? 0;
      return { stock: s, stockStatus: getCatalogStockStatus(s) };
    }
  }
  if (scn && product.colors?.length) {
    const c = product.colors.find(
      (col: OColor) => col.name?.toLowerCase() === String(scn).toLowerCase(),
    );
    if (c && typeof c.stock === 'number') {
      return { stock: c.stock, stockStatus: getCatalogStockStatus(c.stock) };
    }
  }
  return undefined;
}

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

describe('resolveColorStock — bateria property-based (fallback colors[].stock)', () => {
  it('600 casos aleatórios batem com o oráculo (activeColors=null)', () => {
    const r = mulberry32(123456789);
    const hits = { variant: 0, colorFallback: 0, undef: 0 };
    for (let i = 0; i < 600; i++) {
      const nColors = Math.floor(r() * 6);
      const colors: OColor[] = Array.from({ length: nColors }, () => ({
        name: pick(r, NAMES),
        hex: '#000',
        group: '',
        stock: pick(r, STOCKS),
      }));
      const nVars = Math.floor(r() * 5);
      const variations: OVar[] = Array.from({ length: nVars }, () => ({
        color: { name: pick(r, NAMES) },
        stock: pick(r, STOCKS),
      }));
      const base = pick<string | null>(r, [...NAMES, 'Inexistente', '', null]);
      let scn: string | null = base;
      if (typeof base === 'string' && base) {
        scn = r() < 0.5 ? base.toLowerCase() : base.toUpperCase();
      }
      const product: OProduct = { variations, colors };
      const got = rc(product, scn);
      const exp = oracle(product, scn);
      expect(got).toEqual(exp);
      if (
        scn &&
        variations.some((v: OVar) => v.color?.name?.toLowerCase() === String(scn).toLowerCase())
      ) {
        hits.variant++;
      } else if (got) {
        hits.colorFallback++;
      } else {
        hits.undef++;
      }
    }
    expect(hits.variant).toBeGreaterThan(0);
    expect(hits.colorFallback).toBeGreaterThan(0);
    expect(hits.undef).toBeGreaterThan(0);
  });

  it('variant tem precedência sobre colors[].stock (mesma cor)', () => {
    const p: OProduct = {
      variations: [{ color: { name: 'Azul' }, stock: 3 }],
      colors: [{ name: 'Azul', stock: 99 }],
    };
    expect(rc(p, 'Azul')).toEqual({ stock: 3, stockStatus: getCatalogStockStatus(3) });
  });

  it('sem variant correspondente cai no fallback colors[].stock', () => {
    const p: OProduct = {
      variations: [{ color: { name: 'Verde' }, stock: 3 }],
      colors: [{ name: 'Azul', stock: 7 }],
    };
    expect(rc(p, 'Azul')).toEqual({ stock: 7, stockStatus: 'low-stock' });
  });

  it('sem variations, fallback colors[].stock', () => {
    const p: OProduct = { colors: [{ name: 'Azul', stock: 25 }] };
    expect(rc(p, 'Azul')).toEqual({ stock: 25, stockStatus: 'in-stock' });
  });

  it('case-insensitive', () => {
    const p: OProduct = { colors: [{ name: 'Azul Marinho', stock: 4 }] };
    expect(rc(p, 'azul marinho')?.stock).toBe(4);
  });

  it('colors com stock undefined => undefined (guard typeof number)', () => {
    const p: OProduct = { colors: [{ name: 'Azul' }] };
    expect(rc(p, 'Azul')).toBeUndefined();
  });

  it('specificColorName vazio/null => undefined', () => {
    const p: OProduct = { colors: [{ name: 'Azul', stock: 5 }] };
    expect(rc(p, '')).toBeUndefined();
    expect(rc(p, null)).toBeUndefined();
  });

  it('variant.stock null => 0/out-of-stock', () => {
    const p: OProduct = { variations: [{ color: { name: 'Azul' }, stock: null }], colors: [] };
    expect(rc(p, 'Azul')).toEqual({ stock: 0, stockStatus: 'out-of-stock' });
  });

  it('bordas de status via colors[].stock', () => {
    const mk = (s: number): OProduct => ({ colors: [{ name: 'X', stock: s }] });
    expect(rc(mk(10), 'X')?.stockStatus).toBe('in-stock');
    expect(rc(mk(9), 'X')?.stockStatus).toBe('low-stock');
    expect(rc(mk(0), 'X')?.stockStatus).toBe('out-of-stock');
    expect(rc(mk(-1), 'X')?.stockStatus).toBe('out-of-stock');
    expect(rc(mk(-1), 'X')?.stock).toBe(-1);
  });
});

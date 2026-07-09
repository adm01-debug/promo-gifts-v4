/**
 * Testa a limpeza automática das chaves órfãs `cart-table-columns*`
 * e `cart-table-density*` (antigo popover "Colunas / Densidade",
 * removido em 2026-07).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { purgeOrphanCartPrefs } from '../purgeOrphanCartPrefs';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('purgeOrphanCartPrefs', () => {
  it('remove chaves órfãs namespaced (cart-table-columns:<uid>, cart-table-density:<uid>)', () => {
    localStorage.setItem('cart-table-columns:user-1', '["name","price"]');
    localStorage.setItem('cart-table-density:user-1', 'compact');
    localStorage.setItem('cart-table-columns:user-2', '["total"]');

    const removed = purgeOrphanCartPrefs(localStorage);

    expect(removed.sort()).toEqual(
      [
        'cart-table-columns:user-1',
        'cart-table-columns:user-2',
        'cart-table-density:user-1',
      ].sort(),
    );
    expect(localStorage.getItem('cart-table-columns:user-1')).toBeNull();
    expect(localStorage.getItem('cart-table-density:user-1')).toBeNull();
    expect(localStorage.getItem('cart-table-columns:user-2')).toBeNull();
  });

  it('remove chaves legadas sem namespace', () => {
    localStorage.setItem('cart-table-columns', '["name"]');
    localStorage.setItem('cart-table-density', 'cozy');

    purgeOrphanCartPrefs(localStorage);

    expect(localStorage.getItem('cart-table-columns')).toBeNull();
    expect(localStorage.getItem('cart-table-density')).toBeNull();
  });

  it('preserva outras preferências do carrinho (view-mode, sort, page-size, grid-columns)', () => {
    localStorage.setItem('cart-view-mode:user-1', 'table');
    localStorage.setItem('cart-table-sort-key:user-1', 'price');
    localStorage.setItem('cart-table-sort-dir:user-1', 'desc');
    localStorage.setItem('cart-table-page-size:user-1', '50');
    localStorage.setItem('cart-grid-columns:user-1', '4');
    localStorage.setItem('cart-table-columns:user-1', 'órfã');

    purgeOrphanCartPrefs(localStorage);

    expect(localStorage.getItem('cart-view-mode:user-1')).toBe('table');
    expect(localStorage.getItem('cart-table-sort-key:user-1')).toBe('price');
    expect(localStorage.getItem('cart-table-sort-dir:user-1')).toBe('desc');
    expect(localStorage.getItem('cart-table-page-size:user-1')).toBe('50');
    expect(localStorage.getItem('cart-grid-columns:user-1')).toBe('4');
    expect(localStorage.getItem('cart-table-columns:user-1')).toBeNull();
  });

  it('não confunde chaves com prefixo similar (cart-table-columns-legacy não deve casar)', () => {
    // Guarda de regressão: apenas match exato ou `${prefix}:` são órfãos.
    localStorage.setItem('cart-table-columns-legacy', 'manter');
    localStorage.setItem('cart-table-density-old', 'manter');

    purgeOrphanCartPrefs(localStorage);

    expect(localStorage.getItem('cart-table-columns-legacy')).toBe('manter');
    expect(localStorage.getItem('cart-table-density-old')).toBe('manter');
  });

  it('é idempotente (segunda chamada não remove nada e não lança)', () => {
    localStorage.setItem('cart-table-columns:user-1', 'x');

    const first = purgeOrphanCartPrefs(localStorage);
    const second = purgeOrphanCartPrefs(localStorage);

    expect(first).toEqual(['cart-table-columns:user-1']);
    expect(second).toEqual([]);
  });

  it('não lança quando localStorage joga (modo privado / quota)', () => {
    const brokenStorage = {
      get length() {
        throw new Error('QuotaExceeded');
      },
      key: () => null,
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    } as unknown as Storage;

    expect(() => purgeOrphanCartPrefs(brokenStorage)).not.toThrow();
    expect(purgeOrphanCartPrefs(brokenStorage)).toEqual([]);
  });
});

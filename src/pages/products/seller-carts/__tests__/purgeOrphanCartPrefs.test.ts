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

  describe('presença parcial de chaves órfãs', () => {
    it('remove apenas cart-table-columns quando cart-table-density está ausente', () => {
      localStorage.setItem('cart-table-columns:user-1', '["name"]');
      // cart-table-density:user-1 propositalmente ausente.
      localStorage.setItem('cart-view-mode:user-1', 'grid');

      const removed = purgeOrphanCartPrefs(localStorage);

      expect(removed).toEqual(['cart-table-columns:user-1']);
      expect(localStorage.getItem('cart-table-columns:user-1')).toBeNull();
      expect(localStorage.getItem('cart-view-mode:user-1')).toBe('grid');
    });

    it('remove apenas cart-table-density quando cart-table-columns está ausente', () => {
      // cart-table-columns:user-2 propositalmente ausente.
      localStorage.setItem('cart-table-density:user-2', 'compact');
      localStorage.setItem('cart-table-page-size:user-2', '10');

      const removed = purgeOrphanCartPrefs(localStorage);

      expect(removed).toEqual(['cart-table-density:user-2']);
      expect(localStorage.getItem('cart-table-density:user-2')).toBeNull();
      expect(localStorage.getItem('cart-table-page-size:user-2')).toBe('10');
    });

    it('remove mistura de namespaced + legado quando ambos coexistem parcialmente', () => {
      localStorage.setItem('cart-table-columns:user-a', 'ns');
      localStorage.setItem('cart-table-density', 'legado');   // sem namespace
      // cart-table-columns (legado) ausente + cart-table-density:user-a ausente.

      const removed = purgeOrphanCartPrefs(localStorage).sort();

      expect(removed).toEqual(['cart-table-columns:user-a', 'cart-table-density']);
      expect(localStorage.length).toBe(0);
    });

    it('não-op quando nenhuma chave órfã está presente', () => {
      localStorage.setItem('cart-view-mode:user-1', 'list');
      localStorage.setItem('unrelated-key', 'x');

      const removed = purgeOrphanCartPrefs(localStorage);

      expect(removed).toEqual([]);
      expect(localStorage.getItem('cart-view-mode:user-1')).toBe('list');
      expect(localStorage.getItem('unrelated-key')).toBe('x');
    });

    it('remove órfãs de múltiplos uids simultaneamente (apenas density presente para alguns)', () => {
      localStorage.setItem('cart-table-columns:user-a', 'x');
      localStorage.setItem('cart-table-density:user-b', 'x');
      localStorage.setItem('cart-table-columns:user-c', 'x');
      localStorage.setItem('cart-table-density:user-c', 'x');

      const removed = purgeOrphanCartPrefs(localStorage).sort();

      expect(removed).toEqual([
        'cart-table-columns:user-a',
        'cart-table-columns:user-c',
        'cart-table-density:user-b',
        'cart-table-density:user-c',
      ]);
    });
  });
});

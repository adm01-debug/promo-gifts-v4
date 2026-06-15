/**
 * Cobertura do reset diário do catálogo:
 *  - primeiro acesso do dia grava defaults (grid + 6 colunas + sort newest)
 *  - segundo acesso no MESMO dia é no-op
 *  - novo dia dispara reset novamente
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureDailyCatalogDefaults,
  DAILY_RESET_KEY,
  CATALOG_VIEW_MODE_KEY,
  CATALOG_SORT_SESSION_KEY,
} from '@/hooks/products/dailyCatalogDefaults';
import { STORAGE_KEY as GRID_COLUMNS_KEY } from '@/components/products/ColumnSelector';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('ensureDailyCatalogDefaults', () => {
  it('primeiro acesso do dia aplica defaults', () => {
    // usuário tinha preferências antigas
    window.localStorage.setItem(CATALOG_VIEW_MODE_KEY, 'list');
    window.localStorage.setItem(GRID_COLUMNS_KEY, '3');
    window.sessionStorage.setItem(CATALOG_SORT_SESSION_KEY, 'price-asc');

    const fixed = new Date('2026-06-15T09:00:00');
    expect(ensureDailyCatalogDefaults(fixed)).toBe(true);

    expect(window.localStorage.getItem(CATALOG_VIEW_MODE_KEY)).toBe('grid');
    expect(window.localStorage.getItem(GRID_COLUMNS_KEY)).toBe('6');
    expect(window.sessionStorage.getItem(CATALOG_SORT_SESSION_KEY)).toBeNull();
    expect(window.localStorage.getItem(DAILY_RESET_KEY)).toBe('2026-06-15');
  });

  it('segundo acesso no mesmo dia é no-op (preserva escolha do usuário)', () => {
    const fixed = new Date('2026-06-15T09:00:00');
    ensureDailyCatalogDefaults(fixed);

    // usuário trocou para list + 4 cols + price-desc
    window.localStorage.setItem(CATALOG_VIEW_MODE_KEY, 'list');
    window.localStorage.setItem(GRID_COLUMNS_KEY, '4');
    window.sessionStorage.setItem(CATALOG_SORT_SESSION_KEY, 'price-desc');

    expect(ensureDailyCatalogDefaults(fixed)).toBe(false);
    expect(window.localStorage.getItem(CATALOG_VIEW_MODE_KEY)).toBe('list');
    expect(window.localStorage.getItem(GRID_COLUMNS_KEY)).toBe('4');
    expect(window.sessionStorage.getItem(CATALOG_SORT_SESSION_KEY)).toBe('price-desc');
  });

  it('novo dia dispara reset novamente', () => {
    ensureDailyCatalogDefaults(new Date('2026-06-15T23:59:00'));
    window.localStorage.setItem(CATALOG_VIEW_MODE_KEY, 'list');
    window.localStorage.setItem(GRID_COLUMNS_KEY, '8');

    expect(ensureDailyCatalogDefaults(new Date('2026-06-16T00:01:00'))).toBe(true);
    expect(window.localStorage.getItem(CATALOG_VIEW_MODE_KEY)).toBe('grid');
    expect(window.localStorage.getItem(GRID_COLUMNS_KEY)).toBe('6');
    expect(window.localStorage.getItem(DAILY_RESET_KEY)).toBe('2026-06-16');
  });
});

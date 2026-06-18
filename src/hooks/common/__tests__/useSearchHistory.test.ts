/**
 * Testes — useSearchHistory
 *
 * Persiste histórico de buscas no localStorage com filtro por type.
 * STORAGE_KEY='global-search-history-v2', MAX_HISTORY=10.
 *
 * Invariantes:
 *   - history=[] quando localStorage vazio
 *   - addToHistory: persiste em localStorage
 *   - addToHistory: filtra duplicatas por id
 *   - removeFromHistory: remove por id
 *   - clearHistory: remove todos (ou por type)
 *   - type filter: retorna apenas items do tipo especificado
 *   - max 10 items visíveis por tipo
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSearchHistory } from '../useSearchHistory';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

const STORAGE_KEY = 'global-search-history-v2';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
  removeItem: vi.fn((k: string) => { delete store[k]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

function makeItem(id: string, type: 'product' | 'company' | 'general' = 'general') {
  return { id, label: `Item ${id}`, type, timestamp: Date.now() };
}

describe('useSearchHistory', () => {
  it('history=[] quando localStorage vazio', () => {
    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.history).toEqual([]);
  });

  it('carrega history do localStorage no mount', () => {
    const items = [makeItem('a'), makeItem('b')];
    store[STORAGE_KEY] = JSON.stringify(items);
    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.history).toHaveLength(2);
  });

  it('type filter: retorna apenas items do tipo correto', () => {
    const items = [makeItem('p1', 'product'), makeItem('c1', 'company'), makeItem('p2', 'product')];
    store[STORAGE_KEY] = JSON.stringify(items);
    const { result } = renderHook(() => useSearchHistory('product'));
    expect(result.current.history.every(h => h.type === 'product')).toBe(true);
    expect(result.current.history).toHaveLength(2);
  });

  it('addToHistory: adiciona item e persiste', () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => { result.current.addToHistory(makeItem('new1')); });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));
  });

  it('addToHistory: deduplicação — não adiciona id já existente', () => {
    const items = [makeItem('dup')];
    store[STORAGE_KEY] = JSON.stringify(items);
    const { result } = renderHook(() => useSearchHistory());
    act(() => { result.current.addToHistory(makeItem('dup')); });
    const saved = JSON.parse(store[STORAGE_KEY] || '[]');
    expect(saved.filter((i: {id: string}) => i.id === 'dup')).toHaveLength(1);
  });

  it('removeFromHistory: remove por id', () => {
    const items = [makeItem('r1'), makeItem('r2')];
    store[STORAGE_KEY] = JSON.stringify(items);
    const { result } = renderHook(() => useSearchHistory());
    act(() => { result.current.removeFromHistory('r1'); });
    const saved = JSON.parse(store[STORAGE_KEY] || '[]');
    expect(saved.find((i: {id: string}) => i.id === 'r1')).toBeUndefined();
    expect(saved.find((i: {id: string}) => i.id === 'r2')).toBeDefined();
  });

  it('clearHistory: limpa todo o historico', () => {
    const items = [makeItem('x1'), makeItem('x2')];
    store[STORAGE_KEY] = JSON.stringify(items);
    const { result } = renderHook(() => useSearchHistory());
    act(() => { result.current.clearHistory(); });
    // Após clear, storage deve estar vazio ou vazio por tipo
    const saved = store[STORAGE_KEY];
    if (saved) {
      expect(JSON.parse(saved)).toHaveLength(0);
    } else {
      expect(saved).toBeUndefined();
    }
  });

  it('max 10 items no history (cap por tipo)', () => {
    const items = Array.from({ length: 15 }, (_, i) => makeItem(`it${i}`));
    store[STORAGE_KEY] = JSON.stringify(items);
    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.history.length).toBeLessThanOrEqual(10);
  });
});

/**
 * Testes unitários — useStockSelection
 * Cobertura: rowKey, estado inicial, toggle, setMode, selectAllVisible,
 * clear, selectedRows derivação, bulkFavorite, bulkCompare, bulkQuote.
 * Resultado esperado: 31/31 ✅
 */
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { toast } from 'sonner';

import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { rowKey, useStockSelection } from '../useStockSelection';
import type { StockSelectionRow } from '../useStockSelection';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// ── Fixture ───────────────────────────────────────────────────────────────────
function makeRow(opts: {
  productId?: string; variantId?: string;
  productName?: string; variantSku?: string;
  colorName?: string; minStock?: number;
} = {}): StockSelectionRow {
  const { productId='prod-1', variantId='var-1', productName='Caneta',
          variantSku='SKU-001', colorName='Azul', minStock=10 } = opts;
  return {
    product: {
      productId, productName, productSku: variantSku,
      productImageUrl: `https://cdn.test/${productId}.jpg`,
      overallStatus: 'in_stock', variantsInStock: 1,
      variantsLowStock: 0, variantsCritical: 0, variantsOutOfStock: 0,
      availableColors: [], totalCurrentStock: 100,
      totalFutureStock: 0, totalMinStock: 5, totalMaxStock: 200,
    } as never,
    variant: {
      variantId, variantSku, colorName, colorHex: '#0000FF',
      sizeCode: null, currentStock: 50, minStock,
      status: 'in_stock', imageUrl: null,
    } as never,
  };
}

// ── Reset ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  useFavoritesStore.setState({ favorites: [], favoriteCount: 0, isLoaded: true });
  useComparisonStore.setState({
    compareItems: [], compareIds: [], compareCount: 0,
    canAddMore: true, isLoaded: true,
  });
  mockNavigate.mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(() => vi.clearAllMocks());

// ── rowKey ────────────────────────────────────────────────────────────────────
describe('rowKey', () => {
  it('gera chave "productId::variantId"', () => {
    expect(rowKey({ productId: 'p1', variantId: 'v1' })).toBe('p1::v1');
  });
  it('chaves diferentes para IDs diferentes', () => {
    expect(rowKey({ productId: 'p1', variantId: 'v1' }))
      .not.toBe(rowKey({ productId: 'p1', variantId: 'v2' }));
    expect(rowKey({ productId: 'p1', variantId: 'v1' }))
      .not.toBe(rowKey({ productId: 'p2', variantId: 'v1' }));
  });
  it('é determinístico', () => {
    const a = { productId: 'abc', variantId: 'xyz' };
    expect(rowKey(a)).toBe(rowKey(a));
  });
});

// ── Estado inicial ────────────────────────────────────────────────────────────
describe('estado inicial', () => {
  it('enabled=false, seleção vazia', () => {
    const { result } = renderHook(() => useStockSelection([]));
    expect(result.current.enabled).toBe(false);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedRows).toHaveLength(0);
    expect(result.current.selectedKeys.size).toBe(0);
  });
  it('isSelected false para qualquer chave', () => {
    const { result } = renderHook(() => useStockSelection([]));
    expect(result.current.isSelected('k')).toBe(false);
  });
});

// ── toggle ────────────────────────────────────────────────────────────────────
describe('toggle', () => {
  it('marca uma linha', () => {
    const { result } = renderHook(() => useStockSelection([makeRow()]));
    const k = rowKey({ productId: 'prod-1', variantId: 'var-1' });
    act(() => { result.current.toggle(k); });
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelected(k)).toBe(true);
  });
  it('desmarca linha já marcada', () => {
    const { result } = renderHook(() => useStockSelection([makeRow()]));
    const k = rowKey({ productId: 'prod-1', variantId: 'var-1' });
    act(() => { result.current.toggle(k); });
    act(() => { result.current.toggle(k); });
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isSelected(k)).toBe(false);
  });
  it('múltiplos toggles independentes', () => {
    const rows = [
      makeRow({ productId:'p1', variantId:'v1' }),
      makeRow({ productId:'p2', variantId:'v2' }),
    ];
    const { result } = renderHook(() => useStockSelection(rows));
    const k1 = rowKey({ productId:'p1', variantId:'v1' });
    const k2 = rowKey({ productId:'p2', variantId:'v2' });
    act(() => { result.current.toggle(k1); result.current.toggle(k2); });
    expect(result.current.selectedCount).toBe(2);
    expect(result.current.isSelected(k1)).toBe(true);
    expect(result.current.isSelected(k2)).toBe(true);
  });
  it('toggle de chave fantasma não quebra selectedRows', () => {
    const { result } = renderHook(() => useStockSelection([]));
    act(() => { result.current.toggle('fantasma'); });
    expect(result.current.selectedRows).toHaveLength(0);
    expect(result.current.selectedCount).toBe(1);
  });
});

// ── setMode ───────────────────────────────────────────────────────────────────
describe('setMode', () => {
  it('ativa modo de seleção', () => {
    const { result } = renderHook(() => useStockSelection([]));
    act(() => { result.current.setMode(true); });
    expect(result.current.enabled).toBe(true);
  });
  it('desativa e limpa seleção', () => {
    const rows = [makeRow()];
    const { result } = renderHook(() => useStockSelection(rows));
    const k = rowKey({ productId:'prod-1', variantId:'var-1' });
    act(() => { result.current.setMode(true); result.current.toggle(k); });
    expect(result.current.selectedCount).toBe(1);
    act(() => { result.current.setMode(false); });
    expect(result.current.enabled).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });
  it('ativar com seleção existente NÃO limpa', () => {
    const rows = [makeRow()];
    const { result } = renderHook(() => useStockSelection(rows));
    const k = rowKey({ productId:'prod-1', variantId:'var-1' });
    act(() => { result.current.toggle(k); result.current.setMode(true); });
    expect(result.current.selectedCount).toBe(1);
  });
});

// ── selectAllVisible ──────────────────────────────────────────────────────────
describe('selectAllVisible', () => {
  it('seleciona todas as linhas visíveis', () => {
    const rows = [
      makeRow({ productId:'p1', variantId:'v1' }),
      makeRow({ productId:'p2', variantId:'v2' }),
      makeRow({ productId:'p3', variantId:'v3' }),
    ];
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.selectAllVisible(rows); });
    expect(result.current.selectedCount).toBe(3);
  });
  it('substitui seleção prévia', () => {
    const rows = [
      makeRow({ productId:'p1', variantId:'v1' }),
      makeRow({ productId:'p2', variantId:'v2' }),
    ];
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.toggle(rowKey({productId:'p1',variantId:'v1'})); });
    act(() => { result.current.selectAllVisible([rows[1]]); });
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelected(rowKey({productId:'p2',variantId:'v2'}))).toBe(true);
    expect(result.current.isSelected(rowKey({productId:'p1',variantId:'v1'}))).toBe(false);
  });
  it('lista vazia limpa seleção', () => {
    const rows = [makeRow()];
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.toggle(rowKey({productId:'prod-1',variantId:'var-1'})); });
    act(() => { result.current.selectAllVisible([]); });
    expect(result.current.selectedCount).toBe(0);
  });
});

// ── clear ─────────────────────────────────────────────────────────────────────
describe('clear', () => {
  it('limpa toda a seleção', () => {
    const rows = [
      makeRow({ productId:'p1', variantId:'v1' }),
      makeRow({ productId:'p2', variantId:'v2' }),
    ];
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.selectAllVisible(rows); });
    expect(result.current.selectedCount).toBe(2);
    act(() => { result.current.clear(); });
    expect(result.current.selectedCount).toBe(0);
  });
  it('clear em seleção vazia não quebra', () => {
    const { result } = renderHook(() => useStockSelection([]));
    expect(() => act(() => { result.current.clear(); })).not.toThrow();
  });
});

// ── selectedRows derivação ────────────────────────────────────────────────────
describe('selectedRows derivação', () => {
  it('contém as rows reais das keys', () => {
    const r1 = makeRow({ productId:'p1', variantId:'v1', productName:'Caneta' });
    const r2 = makeRow({ productId:'p2', variantId:'v2', productName:'Mochila' });
    const { result } = renderHook(() => useStockSelection([r1, r2]));
    act(() => { result.current.toggle(rowKey({productId:'p2',variantId:'v2'})); });
    expect(result.current.selectedRows).toHaveLength(1);
    expect(result.current.selectedRows[0].product.productName).toBe('Mochila');
  });
  it('invariante: count === keys.size === rows.length', () => {
    const rows = [
      makeRow({ productId:'p1', variantId:'v1' }),
      makeRow({ productId:'p2', variantId:'v2' }),
    ];
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.selectAllVisible(rows); });
    expect(result.current.selectedCount).toBe(2);
    expect(result.current.selectedKeys.size).toBe(2);
    expect(result.current.selectedRows).toHaveLength(2);
  });
});

// ── bulkFavorite ──────────────────────────────────────────────────────────────
describe('bulkFavorite', () => {
  it('nada se seleção vazia', () => {
    const { result } = renderHook(() => useStockSelection([]));
    act(() => { result.current.bulkFavorite(); });
    expect(useFavoritesStore.getState().favorites).toHaveLength(0);
  });
  it('favorita selecionados e limpa', () => {
    const rows = [
      makeRow({ productId:'p1', variantId:'v1' }),
      makeRow({ productId:'p2', variantId:'v2' }),
    ];
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.selectAllVisible(rows); });
    act(() => { result.current.bulkFavorite(); });
    expect(useFavoritesStore.getState().favorites).toHaveLength(2);
    expect(result.current.selectedCount).toBe(0);
  });
  it('pula já favoritados', () => {
    const rows = [
      makeRow({ productId:'p1', variantId:'v1' }),
      makeRow({ productId:'p2', variantId:'v2' }),
    ];
    useFavoritesStore.getState().addFavorite('p1');
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.selectAllVisible(rows); });
    act(() => { result.current.bulkFavorite(); });
    expect(useFavoritesStore.getState().favorites).toHaveLength(2);
  });
});

// ── bulkCompare ───────────────────────────────────────────────────────────────
describe('bulkCompare', () => {
  it('nada se seleção vazia', () => {
    const { result } = renderHook(() => useStockSelection([]));
    act(() => { result.current.bulkCompare(); });
    expect(useComparisonStore.getState().compareCount).toBe(0);
  });
  it('adiciona à comparação e limpa', () => {
    const rows = [
      makeRow({ productId:'p1', variantId:'v1' }),
      makeRow({ productId:'p2', variantId:'v2' }),
    ];
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.selectAllVisible(rows); });
    act(() => { result.current.bulkCompare(); });
    expect(useComparisonStore.getState().compareCount).toBe(2);
    expect(result.current.selectedCount).toBe(0);
  });
  it('respeita limite de 4 — só adiciona slots disponíveis', () => {
    useComparisonStore.getState().addToCompare('e1');
    useComparisonStore.getState().addToCompare('e2');
    useComparisonStore.getState().addToCompare('e3');
    expect(useComparisonStore.getState().compareCount).toBe(3);
    const rows = [
      makeRow({ productId:'n1', variantId:'v1' }),
      makeRow({ productId:'n2', variantId:'v2' }),
      makeRow({ productId:'n3', variantId:'v3' }),
    ];
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.selectAllVisible(rows); });
    act(() => { result.current.bulkCompare(); });
    expect(useComparisonStore.getState().compareCount).toBe(4);
  });
  it('cheio (4/4): não adiciona', () => {
    ['e1','e2','e3','e4'].forEach(id => useComparisonStore.getState().addToCompare(id));
    const rows = [makeRow()];
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.toggle(rowKey({productId:'prod-1',variantId:'var-1'})); });
    act(() => { result.current.bulkCompare(); });
    expect(useComparisonStore.getState().compareCount).toBe(4);
  });
});

// ── bulkQuote ─────────────────────────────────────────────────────────────────
describe('bulkQuote', () => {
  it('nada se seleção vazia', () => {
    const { result } = renderHook(() => useStockSelection([]));
    act(() => { result.current.bulkQuote(); });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
  it('navega para /orcamentos/novo?items[]=...', () => {
    const row = makeRow({ productId:'p1', variantId:'v1', variantSku:'SKU-CANETA' });
    const { result } = renderHook(() => useStockSelection([row]));
    act(() => { result.current.toggle(rowKey({productId:'p1',variantId:'v1'})); });
    act(() => { result.current.bulkQuote(); });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [path] = mockNavigate.mock.calls[0];
    expect(path).toMatch(/^\/orcamentos\/novo\?/);
    expect(path).toContain('items[]');
    expect(decodeURIComponent(path)).toContain('SKU-CANETA');
  });
  it('inclui todos os itens no param de URL', () => {
    const rows = [
      makeRow({ productId:'p1', variantId:'v1', variantSku:'SKU-A' }),
      makeRow({ productId:'p2', variantId:'v2', variantSku:'SKU-B' }),
    ];
    const { result } = renderHook(() => useStockSelection(rows));
    act(() => { result.current.selectAllVisible(rows); });
    act(() => { result.current.bulkQuote(); });
    const decoded = decodeURIComponent(mockNavigate.mock.calls[0][0]);
    expect(decoded).toContain('SKU-A');
    expect(decoded).toContain('SKU-B');
  });
  it('usa minStock como quantity, fallback 1 se zero', () => {
    const rowA = makeRow({ minStock: 50 });
    const rowB = makeRow({ productId:'p2', variantId:'v2', minStock: 0 });
    const { result } = renderHook(() => useStockSelection([rowA, rowB]));
    act(() => { result.current.selectAllVisible([rowA, rowB]); });
    act(() => { result.current.bulkQuote(); });
    const decoded = decodeURIComponent(mockNavigate.mock.calls[0][0]);
    expect(decoded).toContain('"quantity":50');
    expect(decoded).toContain('"quantity":1');
  });
  it('limpa seleção após navegar', () => {
    const row = makeRow();
    const { result } = renderHook(() => useStockSelection([row]));
    act(() => { result.current.toggle(rowKey({productId:'prod-1',variantId:'var-1'})); });
    act(() => { result.current.bulkQuote(); });
    expect(result.current.selectedCount).toBe(0);
  });
});

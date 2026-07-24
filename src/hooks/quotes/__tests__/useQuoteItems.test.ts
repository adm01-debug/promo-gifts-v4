/**
 * Testes — useQuoteItems
 *
 * Hook de gestão de itens de orçamento (estado local, sem DB).
 *
 * Invariantes críticas:
 *   BUG-03: reindexar expandedItems ao remover item (índices subsequentes -1)
 *   B2B minQuantity: primeiro add usa minQuantity como qty inicial
 *   deduplicação: product+color+size iguais -> incrementa qty
 *   updateItemPrice clamp: price<0 -> 0, NaN -> 0
 *   updateItemQuantity clamp: quantity<1 -> noop
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { useQuoteItems } from '../useQuoteItems';

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const P1 = {
  id: 'p1',
  name: 'Caneta Azul',
  sku: 'CA-001',
  price: 5.99,
  images: ['https://img/p1.jpg'],
  minQuantity: 1,
};
const P2 = {
  id: 'p2',
  name: 'Bloco A5',
  sku: 'BL-002',
  price: 12.5,
  images: null,
  minQuantity: 50,
};
const VARIANT_BLUE = {
  color_name: 'Azul',
  color_hex: '#0000FF',
  size_code: 'U',
  selected_thumbnail: null,
  images: null,
  bitrix_product_id: null,
};

beforeEach(() => vi.clearAllMocks());

// -- Estado inicial ----------------------------------------------------------
describe('estado inicial', () => {
  it('items, activeItemIndex e expandedItems iniciam vazios', () => {
    const { result } = renderHook(() => useQuoteItems());
    expect(result.current.items).toEqual([]);
    expect(result.current.activeItemIndex).toBeNull();
    expect(result.current.expandedItems.size).toBe(0);
  });

  it('aceita initialItems como seed', () => {
    const seed = [{ product_id: 'x', quantity: 3 }] as never;
    const { result } = renderHook(() => useQuoteItems(seed));
    expect(result.current.items).toHaveLength(1);
  });
});

// -- addProductWithColor -----------------------------------------------------
describe('addProductWithColor', () => {
  it('adiciona item com campos corretos', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    const [item] = result.current.items;
    expect(item.product_id).toBe('p1');
    expect(item.product_name).toBe('Caneta Azul');
    expect(item.unit_price).toBe(5.99);
    expect(item.personalizations).toEqual([]);
  });

  it('minQuantity B2B: qty inicial = minQuantity (nao 1)', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P2, null);
    });
    expect(result.current.items[0].quantity).toBe(50);
  });

  it('deduplicacao: mesmo product+color+size incrementa qty', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, VARIANT_BLUE as never);
    });
    act(() => {
      result.current.addProductWithColor(P1, VARIANT_BLUE as never);
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('deduplicacao: chama toast.info ao incrementar', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Caneta Azul'));
  });

  it('produtos diferentes: cria dois itens separados', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    act(() => {
      result.current.addProductWithColor(P2, null);
    });
    expect(result.current.items).toHaveLength(2);
  });
});

// -- updateItemQuantity -------------------------------------------------------
describe('updateItemQuantity', () => {
  it('atualiza quantidade corretamente', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    act(() => {
      result.current.updateItemQuantity(0, 10);
    });
    expect(result.current.items[0].quantity).toBe(10);
  });

  it('quantity < 1 e um noop (nao atualiza)', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    act(() => {
      result.current.updateItemQuantity(0, 0);
    });
    expect(result.current.items[0].quantity).toBe(1);
  });
});

// -- updateItemPrice ---------------------------------------------------------
describe('updateItemPrice', () => {
  it('atualiza preco positivo corretamente', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    act(() => {
      result.current.updateItemPrice(0, 8.99);
    });
    expect(result.current.items[0].unit_price).toBe(8.99);
  });

  it('preco negativo clamped para 0', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    act(() => {
      result.current.updateItemPrice(0, -5);
    });
    expect(result.current.items[0].unit_price).toBe(0);
  });

  it('NaN clamped para 0', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    act(() => {
      result.current.updateItemPrice(0, NaN);
    });
    expect(result.current.items[0].unit_price).toBe(0);
  });
});

// -- removeItem --------------------------------------------------------------
describe('removeItem', () => {
  it('remove item pelo indice', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    act(() => {
      result.current.addProductWithColor(P2, null);
    });
    act(() => {
      result.current.removeItem(0);
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].product_id).toBe('p2');
  });

  it('activeItemIndex: anula quando item ativo e removido', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    expect(result.current.activeItemIndex).toBe(0);
    act(() => {
      result.current.removeItem(0);
    });
    expect(result.current.activeItemIndex).toBeNull();
  });

  it('BUG-03: reindexar expandedItems — indices subsequentes decrementados', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    act(() => {
      result.current.addProductWithColor(P2, null);
    });
    act(() => {
      result.current.addProductWithColor({ ...P1, id: 'p3' }, null);
    });
    // addProductWithColor auto-expands each item → {0,1,2}; reset before test scenario
    act(() => {
      result.current.setExpandedItems(new Set());
    });
    act(() => {
      result.current.setExpandedItems(new Set([1, 2]));
    });
    act(() => {
      result.current.removeItem(0);
    });
    // idx 1 -> 0, idx 2 -> 1
    expect(result.current.expandedItems.has(0)).toBe(true);
    expect(result.current.expandedItems.has(1)).toBe(true);
    expect(result.current.expandedItems.has(2)).toBe(false);
  });

  it('BUG-03: item anterior ao removido nao muda de indice', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    act(() => {
      result.current.addProductWithColor(P2, null);
    });
    act(() => {
      result.current.addProductWithColor({ ...P1, id: 'p3' }, null);
    });
    // addProductWithColor auto-expands each item → {0,1,2}; reset before test scenario
    act(() => {
      result.current.setExpandedItems(new Set());
    });
    act(() => {
      result.current.setExpandedItems(new Set([0]));
    });
    act(() => {
      result.current.removeItem(2);
    });
    expect(result.current.expandedItems.has(0)).toBe(true);
  });
});

// -- toggleExpanded ----------------------------------------------------------
describe('toggleExpanded', () => {
  it('adiciona ao Set quando fechado', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    // addProductWithColor auto-expands index 0; reset to test toggle-open from closed state
    act(() => {
      result.current.setExpandedItems(new Set());
    });
    act(() => {
      result.current.toggleExpanded(0);
    });
    expect(result.current.expandedItems.has(0)).toBe(true);
  });

  it('remove do Set quando aberto (toggle off)', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.toggleExpanded(0); // open
    });
    // addProductWithColor auto-expands index 0; reset then open explicitly
    act(() => {
      result.current.setExpandedItems(new Set());
    });
    // addProductWithColor auto-expands index 0; reset then open explicitly
    act(() => {
      result.current.toggleExpanded(0); // open
    });
    act(() => {
      result.current.toggleExpanded(0); // close
    });
    expect(result.current.expandedItems.has(0)).toBe(false);
  });
});

// -- confirmItemPrice --------------------------------------------------------
describe('confirmItemPrice', () => {
  it('seta price_confirmed_at com ISO timestamp', () => {
    const { result } = renderHook(() => useQuoteItems());
    act(() => {
      result.current.addProductWithColor(P1, null);
    });
    const before = new Date().toISOString();
    act(() => {
      result.current.confirmItemPrice(0);
    });
    const after = new Date().toISOString();
    const ts = (result.current.items[0] as Record<string, unknown>).price_confirmed_at as string;
    expect(ts).toBeTruthy();
    expect(ts >= before).toBe(true);
    expect(ts <= after).toBe(true);
  });
});

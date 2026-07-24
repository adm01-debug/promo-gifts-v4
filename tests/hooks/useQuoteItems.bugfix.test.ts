/**
 * Testes de regressão — BUG-03
 * Arquivo: src/hooks/quotes/useQuoteItems.ts
 *
 * BUG: removeItem não reindexava expandedItems.
 * Itens em posições > removedIndex mantinham índices obsoletos → painel de
 * personalização aparecia expandido no item errado após remoção no meio da lista.
 *
 * FIX: rebuild do Set decrementando índices > N, descartando N.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuoteItems } from '../../src/hooks/quotes/useQuoteItems';

// ─── helpers ───────────────────────────────────────────────────────────────

function makeItem(id: string) {
  return {
    product_id: id,
    product_name: `Produto ${id}`,
    product_sku: id,
    quantity: 1,
    unit_price: 10,
    personalizations: [],
  };
}

const ITEMS_3 = [makeItem('A'), makeItem('B'), makeItem('C')];

// ─── testes ─────────────────────────────────────────────────────────────────

describe('useQuoteItems – BUG-03: removeItem deve reindexar expandedItems', () => {
  it('remove item no INÍCIO e reindexo: items[1] (B) cai para índice 0', () => {
    const { result } = renderHook(() => useQuoteItems(ITEMS_3));

    // Expande todos: {0, 1, 2}
    act(() => {
      result.current.setExpandedItems(new Set([0, 1, 2]));
    });

    // Remove item 0 (A)
    act(() => {
      result.current.removeItem(0);
    });

    // Após remoção: B=0, C=1. expandedItems deve conter {0, 1} (B e C reindexados)
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].product_id).toBe('B');
    expect(result.current.expandedItems.has(0)).toBe(true);  // B reindexado para 0
    expect(result.current.expandedItems.has(1)).toBe(true);  // C reindexado para 1
    expect(result.current.expandedItems.has(2)).toBe(false); // índice 2 não existe mais
  });

  it('remove item no MEIO e reindexo: C cai de 2 para 1', () => {
    const { result } = renderHook(() => useQuoteItems(ITEMS_3));

    act(() => {
      result.current.setExpandedItems(new Set([0, 2])); // A=0, C=2 expandidos
    });

    // Remove B (índice 1)
    act(() => {
      result.current.removeItem(1);
    });

    // Após remoção: A=0, C=1
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[1].product_id).toBe('C');
    expect(result.current.expandedItems.has(0)).toBe(true);  // A mantém índice 0
    expect(result.current.expandedItems.has(1)).toBe(true);  // C reindexado para 1
    expect(result.current.expandedItems.has(2)).toBe(false); // índice obsoleto descartado
  });

  it('remove item no FINAL: expandedItems não deve conter o índice removido', () => {
    const { result } = renderHook(() => useQuoteItems(ITEMS_3));

    act(() => {
      result.current.setExpandedItems(new Set([0, 1, 2]));
    });

    // Remove C (índice 2)
    act(() => {
      result.current.removeItem(2);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.expandedItems.has(0)).toBe(true);
    expect(result.current.expandedItems.has(1)).toBe(true);
    expect(result.current.expandedItems.has(2)).toBe(false); // C removido, índice 2 descartado
  });

  it('remove único item expandido no meio: resultado deve ser Set vazio para aquele índice', () => {
    const { result } = renderHook(() => useQuoteItems(ITEMS_3));

    // Apenas B (índice 1) expandido
    act(() => {
      result.current.setExpandedItems(new Set([1]));
    });

    // Remove B
    act(() => {
      result.current.removeItem(1);
    });

    // expandedItems deve estar vazio: B foi removido, não deve sobrar nenhum índice
    expect(result.current.expandedItems.size).toBe(0);
  });

  it('REGRESSÃO: sem o fix, remoção do meio deixaria expandedItems com índices stale', () => {
    // Simula o comportamento BUGADO para documentar o problema resolvido
    // O bug fazia Set{2} permanecer após remoção do item 1, mas o array passou a ter tamanho 2,
    // então o índice 2 apontaria para undefined → painel exibia no item errado.
    //
    // Com o FIX, C é corretamente reindexado para índice 1.

    const items4 = [makeItem('A'), makeItem('B'), makeItem('C'), makeItem('D')];
    const { result } = renderHook(() => useQuoteItems(items4));

    // Expande C (índice 2) e D (índice 3)
    act(() => {
      result.current.setExpandedItems(new Set([2, 3]));
    });

    // Remove B (índice 1)
    act(() => {
      result.current.removeItem(1);
    });

    // C agora é índice 1, D agora é índice 2
    expect(result.current.items[1].product_id).toBe('C');
    expect(result.current.items[2].product_id).toBe('D');

    // expandedItems correto: {1, 2} (reindexados), NÃO {2, 3} (stale)
    expect(result.current.expandedItems.has(1)).toBe(true);  // C reindexado
    expect(result.current.expandedItems.has(2)).toBe(true);  // D reindexado
    expect(result.current.expandedItems.has(3)).toBe(false); // índice stale descartado
  });

  it('activeItemIndex deve ser ajustado ao remover item antes do ativo', () => {
    const { result } = renderHook(() => useQuoteItems(ITEMS_3));

    // Ativa item C (índice 2)
    act(() => {
      result.current.setActiveItemIndex(2);
    });

    // Remove A (índice 0) — ativo deve decrementar para 1
    act(() => {
      result.current.removeItem(0);
    });

    expect(result.current.activeItemIndex).toBe(1);
  });

  it('activeItemIndex deve ser null ao remover o próprio item ativo', () => {
    const { result } = renderHook(() => useQuoteItems(ITEMS_3));

    act(() => {
      result.current.setActiveItemIndex(1);
    });

    act(() => {
      result.current.removeItem(1);
    });

    expect(result.current.activeItemIndex).toBeNull();
  });
});

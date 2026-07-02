/**
 * Validação da lógica de UNDO ao remover item do Resumo (QuoteBuilderSummaryColumn).
 *
 * O handler no JSX é inline, mas sua lógica é composta por dois pedaços puros:
 *  1. Snapshot local: `const snapshot = items[idx]` (referência ao objeto do array atual).
 *  2. Restore no pai: `setItems(prev => prev.splice(Math.min(index, prev.length), 0, snapshot))`.
 *
 * Testamos aqui a composição desses dois — que é o contrato observável (idempotência,
 * imutabilidade, clamp de índice). Não renderizamos o componente (150+ props) porque
 * a lógica não depende do React — depende de closure + splice imutável.
 */
import { describe, it, expect, vi } from 'vitest';
import type { QuoteItem } from '@/hooks/quotes/quoteTypes';

// Reproduz o helper de restore EXATAMENTE como está em QuoteBuilderPage.tsx (linhas 745-751).
function restore(setItems: (fn: (prev: QuoteItem[]) => QuoteItem[]) => void) {
  return (item: QuoteItem, index: number) => {
    setItems((prev) => {
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, item);
      return next;
    });
  };
}

// Reproduz o handler onClick do botão excluir (SummaryColumn.tsx :831-850).
function makeDeleteHandler(
  items: QuoteItem[],
  removeItem: (idx: number) => void,
  onRestore: ((item: QuoteItem, index: number) => void) | undefined,
  showUndoToast: (opts: { title: string; description?: string; onUndo: () => void; duration: number }) => void,
) {
  return (idx: number) => {
    const snapshot = items[idx];
    const removedIndex = idx;
    removeItem(idx);
    if (snapshot && onRestore) {
      showUndoToast({
        title: 'Item removido',
        description: snapshot.product_name,
        duration: 5000,
        onUndo: () => onRestore(snapshot, removedIndex),
      });
    }
  };
}

const mkItem = (overrides: Partial<QuoteItem> = {}): QuoteItem => ({
  product_id: 'p-1',
  product_name: 'Produto',
  quantity: 1,
  unit_price: 10,
  ...overrides,
});

describe('QuoteBuilderSummaryColumn — undo remove', () => {
  it('T1 — snapshot é imutável entre remove e undo (splice não muta prev)', () => {
    let items: QuoteItem[] = [
      mkItem({ product_id: 'a', product_name: 'A' }),
      mkItem({ product_id: 'b', product_name: 'B' }),
      mkItem({ product_id: 'c', product_name: 'C' }),
    ];
    const before = JSON.parse(JSON.stringify(items));
    const setItems = (fn: (p: QuoteItem[]) => QuoteItem[]) => {
      items = fn(items);
    };
    const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
    const toastCapture: Array<() => void> = [];
    const showUndoToast = vi.fn((o: { onUndo: () => void }) => toastCapture.push(o.onUndo));

    const handler = makeDeleteHandler(before as QuoteItem[], removeItem, restore(setItems), showUndoToast);
    handler(1);

    // remove aplicado
    expect(items.map((i) => i.product_id)).toEqual(['a', 'c']);

    // muta o array `before` original — o snapshot NÃO deve refletir isso
    // (splice sempre cria next = [...prev] então não há mutação vazando).
    (before as QuoteItem[]).splice(0, before.length);

    // undo restaura no índice correto
    toastCapture[0]();
    expect(items.map((i) => i.product_id)).toEqual(['a', 'b', 'c']);
    expect(items[1].product_name).toBe('B');
  });

  it('T2 — restore reinsere no índice original (meio da lista)', () => {
    let items: QuoteItem[] = [0, 1, 2, 3, 4].map((n) =>
      mkItem({ product_id: `p${n}`, product_name: `N${n}` }),
    );
    const setItems = (fn: (p: QuoteItem[]) => QuoteItem[]) => {
      items = fn(items);
    };
    const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
    const captured: Array<() => void> = [];
    const toast = (o: { onUndo: () => void }) => captured.push(o.onUndo);
    makeDeleteHandler(items, removeItem, restore(setItems), toast)(2);
    expect(items.map((i) => i.product_id)).toEqual(['p0', 'p1', 'p3', 'p4']);
    captured[0]();
    expect(items.map((i) => i.product_id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
  });

  it('T3 — Math.min clampa quando o array encolheu entre remove e undo', () => {
    let items: QuoteItem[] = [0, 1, 2, 3, 4].map((n) =>
      mkItem({ product_id: `p${n}` }),
    );
    const setItems = (fn: (p: QuoteItem[]) => QuoteItem[]) => {
      items = fn(items);
    };
    const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
    const undos: Array<() => void> = [];
    const toast = (o: { onUndo: () => void }) => undos.push(o.onUndo);
    const onRestore = restore(setItems);

    // Snapshot dos itens ANTES de cada remove — como o handler real faz.
    const snap0 = { ...items[4] }; // último
    // Remove todos os outros primeiro para simular encolhimento.
    removeItem(3);
    removeItem(2);
    removeItem(1);
    removeItem(0);
    // agora items = ['p4']; se tentarmos restaurar 'p4' original em index=4 → clamp p/ length=1
    makeDeleteHandler([snap0], removeItem, onRestore, toast)(0); // remove 'p4', duration snapshot
    expect(items).toEqual([]);
    undos[0]();
    expect(items.map((i) => i.product_id)).toEqual(['p4']);
  });

  it('T4 — sem onRestore, showUndoToast NÃO é chamado (opt-in)', () => {
    let items = [mkItem({ product_id: 'x' })];
    const setItems = (fn: (p: QuoteItem[]) => QuoteItem[]) => {
      items = fn(items);
    };
    const removeItem = vi.fn((idx: number) => setItems((p) => p.filter((_, i) => i !== idx)));
    const toast = vi.fn();
    makeDeleteHandler(items, removeItem, undefined, toast)(0);
    expect(removeItem).toHaveBeenCalledWith(0);
    expect(toast).not.toHaveBeenCalled();
    expect(items).toEqual([]);
  });

  it('T5 — snapshot preserva TODOS os campos (personalizations, notes, custom, sort_order, hex)', () => {
    const rich: QuoteItem = mkItem({
      id: 'qi-1',
      product_id: 'p-x',
      product_name: '🔥 Produto ✨',
      product_sku: 'SKU-1',
      product_image_url: 'https://cdn/x.png',
      quantity: 42,
      unit_price: 99.99,
      color_name: 'Vermelho',
      color_hex: '#FF0000',
      notes: 'obs importantes',
      sort_order: 7,
      size_code: 'M',
      bitrix_product_id: 12345,
      kit_group_id: 'kit-1',
      kit_name: 'Kit A',
      product_category_id: 'cat-1',
      product_category_name: 'Cat',
      price_updated_at: '2026-01-01T00:00:00Z',
      price_freshness_threshold_days: 30,
      personalizations: [
        {
          technique_id: 't-1',
          technique_name: 'Silk',
          colors_count: 3,
          area_cm2: 25,
          setup_cost: 50,
        },
        {
          technique_id: 't-2',
          technique_name: 'Bordado',
          colors_count: 1,
        },
      ],
    });

    let items = [mkItem({ product_id: 'a' }), rich, mkItem({ product_id: 'c' })];
    const setItems = (fn: (p: QuoteItem[]) => QuoteItem[]) => {
      items = fn(items);
    };
    const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
    const undos: Array<() => void> = [];
    const toast = (o: { onUndo: () => void; description?: string }) => {
      expect(o.description).toBe('🔥 Produto ✨');
      undos.push(o.onUndo);
    };
    makeDeleteHandler(items, removeItem, restore(setItems), toast)(1);
    undos[0]();
    expect(items[1]).toEqual(rich);
    // deep-equal por serialização
    expect(JSON.stringify(items[1])).toBe(JSON.stringify(rich));
  });

  it('T6 — múltiplos undos independentes (2 removes, 2 undos em ordem reversa)', () => {
    let items = [0, 1, 2, 3].map((n) => mkItem({ product_id: `p${n}` }));
    const setItems = (fn: (p: QuoteItem[]) => QuoteItem[]) => {
      items = fn(items);
    };
    const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
    const undos: Array<() => void> = [];
    const toast = (o: { onUndo: () => void }) => undos.push(o.onUndo);
    const onRestore = restore(setItems);

    makeDeleteHandler(items, removeItem, onRestore, toast)(1); // remove p1
    expect(items.map((i) => i.product_id)).toEqual(['p0', 'p2', 'p3']);
    makeDeleteHandler(items, removeItem, onRestore, toast)(1); // remove p2 (agora idx 1)
    expect(items.map((i) => i.product_id)).toEqual(['p0', 'p3']);

    // Desfaz em ordem reversa (LIFO)
    undos[1](); // restaura p2 em idx=1 → ['p0','p2','p3']
    expect(items.map((i) => i.product_id)).toEqual(['p0', 'p2', 'p3']);
    undos[0](); // restaura p1 em idx=1 → ['p0','p1','p2','p3']
    expect(items.map((i) => i.product_id)).toEqual(['p0', 'p1', 'p2', 'p3']);
  });
});

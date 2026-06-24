/**
 * Validação exaustiva da SSOT `collapsedItemsStorage`.
 *
 * Cobre:
 *  - Construção da chave por `quoteId` (string/null/undefined/vazio/whitespace)
 *  - Inicialização do estado (chave inexistente, JSON corrompido, tipos errados)
 *  - Isolamento entre orçamentos (`new` ↔ ids reais, UUIDs, prefixos parecidos)
 *  - Persistência de toggle (add/remove/atomicidade)
 *  - Resiliência a `localStorage` indisponível / lançando erro
 *  - `pruneCollapsedItems` removendo apenas chaves órfãs sem write desnecessário
 *  - Limpeza automática quando o set fica vazio (não polui storage)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  COLLAPSED_ITEMS_KEY_PREFIX,
  NEW_QUOTE_FALLBACK,
  collapsedItemsStorageKey,
  loadCollapsedItems,
  saveCollapsedItems,
  toggleCollapsedItem,
  pruneCollapsedItems,
  normalizeQuoteId,
} from '../collapsedItemsStorage';

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('normalizeQuoteId', () => {
  it('mapeia null/undefined/""/"   " para "new"', () => {
    expect(normalizeQuoteId(null)).toBe(NEW_QUOTE_FALLBACK);
    expect(normalizeQuoteId(undefined)).toBe(NEW_QUOTE_FALLBACK);
    expect(normalizeQuoteId('')).toBe(NEW_QUOTE_FALLBACK);
    expect(normalizeQuoteId('   ')).toBe(NEW_QUOTE_FALLBACK);
  });

  it('preserva ids reais (e faz trim)', () => {
    expect(normalizeQuoteId('quote-abc')).toBe('quote-abc');
    expect(normalizeQuoteId('  quote-abc  ')).toBe('quote-abc');
  });
});

describe('collapsedItemsStorageKey', () => {
  it('usa o prefixo SSOT e o fallback "new"', () => {
    expect(collapsedItemsStorageKey(null)).toBe(`${COLLAPSED_ITEMS_KEY_PREFIX}:new`);
    expect(collapsedItemsStorageKey('q-1')).toBe(`${COLLAPSED_ITEMS_KEY_PREFIX}:q-1`);
  });
});

describe('loadCollapsedItems — inicialização', () => {
  it('chave inexistente ⇒ Set vazio', () => {
    expect(loadCollapsedItems('q-x').size).toBe(0);
    expect(loadCollapsedItems(null).size).toBe(0);
  });

  it('JSON corrompido ⇒ Set vazio (não lança)', () => {
    window.localStorage.setItem(collapsedItemsStorageKey('q'), '{not json');
    expect(loadCollapsedItems('q').size).toBe(0);
  });

  it('payload não-array ⇒ Set vazio', () => {
    for (const garbage of ['{}', '"abc"', 'null', '42', 'true']) {
      window.localStorage.setItem(collapsedItemsStorageKey('q'), garbage);
      expect(loadCollapsedItems('q').size).toBe(0);
    }
  });

  it('filtra entradas inválidas dentro do array', () => {
    window.localStorage.setItem(
      collapsedItemsStorageKey('q'),
      JSON.stringify(['a', '', null, 1, 'b', { x: 1 }]),
    );
    const s = loadCollapsedItems('q');
    expect([...s].sort()).toEqual(['a', 'b']);
  });

  it('localStorage lançando ⇒ Set vazio (não propaga)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => loadCollapsedItems('q')).not.toThrow();
    expect(loadCollapsedItems('q').size).toBe(0);
  });
});

describe('saveCollapsedItems — persistência', () => {
  it('grava set como JSON array', () => {
    saveCollapsedItems('q', new Set(['a', 'b']));
    const raw = window.localStorage.getItem(collapsedItemsStorageKey('q'));
    expect(JSON.parse(raw!).sort()).toEqual(['a', 'b']);
  });

  it('set vazio remove a chave (não polui storage)', () => {
    window.localStorage.setItem(collapsedItemsStorageKey('q'), '["a"]');
    saveCollapsedItems('q', new Set());
    expect(window.localStorage.getItem(collapsedItemsStorageKey('q'))).toBeNull();
  });

  it('setItem lançando não propaga', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveCollapsedItems('q', new Set(['a']))).not.toThrow();
  });
});

describe('Isolamento entre quoteIds', () => {
  it('"new" não vaza para id salvo (transição create → edit)', () => {
    saveCollapsedItems(null, new Set(['item-1']));
    expect(loadCollapsedItems(null).has('item-1')).toBe(true);
    expect(loadCollapsedItems('quote-abc').size).toBe(0);
  });

  it('toggle em quote-A não altera quote-B (cenário do bug)', () => {
    const a1 = toggleCollapsedItem('quote-A', new Set(), 'item-x');
    expect(a1.has('item-x')).toBe(true);
    expect(loadCollapsedItems('quote-B').size).toBe(0);

    const b1 = toggleCollapsedItem('quote-B', new Set(), 'item-y');
    expect(b1.has('item-y')).toBe(true);
    // A continua intacto
    expect([...loadCollapsedItems('quote-A')]).toEqual(['item-x']);
    expect([...loadCollapsedItems('quote-B')]).toEqual(['item-y']);
  });

  it('200 orçamentos × 5 itens não colidem entre si', () => {
    for (let q = 0; q < 200; q++) {
      const ids = Array.from({ length: 5 }, (_, i) => `i-${q}-${i}`);
      saveCollapsedItems(`q-${q}`, new Set(ids));
    }
    for (let q = 0; q < 200; q++) {
      const s = loadCollapsedItems(`q-${q}`);
      expect(s.size).toBe(5);
      expect(s.has(`i-${q}-0`)).toBe(true);
      expect(s.has(`i-${q + 1}-0`)).toBe(false);
    }
  });

  it('UUIDs reais não colidem (100 amostras)', () => {
    const ids = Array.from({ length: 100 }, () => crypto.randomUUID());
    ids.forEach((id, i) => saveCollapsedItems(id, new Set([`it-${i}`])));
    ids.forEach((id, i) => {
      expect([...loadCollapsedItems(id)]).toEqual([`it-${i}`]);
    });
  });
});

describe('toggleCollapsedItem', () => {
  it('500 toggles repetidos mantêm consistência', () => {
    let s = new Set<string>();
    for (let i = 0; i < 500; i++) s = toggleCollapsedItem('fuzz', s, 'k');
    // 500 toggles ⇒ par ⇒ vazio
    expect(s.size).toBe(0);
    expect(loadCollapsedItems('fuzz').size).toBe(0);
  });

  it('toggles independentes em chaves diferentes', () => {
    let s = new Set<string>();
    s = toggleCollapsedItem('q', s, 'a');
    s = toggleCollapsedItem('q', s, 'b');
    s = toggleCollapsedItem('q', s, 'a'); // desliga 'a'
    expect([...s]).toEqual(['b']);
    expect([...loadCollapsedItems('q')]).toEqual(['b']);
  });
});

describe('pruneCollapsedItems — limpeza de chaves órfãs', () => {
  it('remove ids que não estão mais em items', () => {
    saveCollapsedItems('q', new Set(['a', 'b', 'c']));
    const cleaned = pruneCollapsedItems('q', loadCollapsedItems('q'), ['a', 'c']);
    expect([...cleaned].sort()).toEqual(['a', 'c']);
    expect([...loadCollapsedItems('q')].sort()).toEqual(['a', 'c']);
  });

  it('sem órfãos ⇒ não grava (zero writes)', () => {
    saveCollapsedItems('q', new Set(['a']));
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    pruneCollapsedItems('q', loadCollapsedItems('q'), ['a', 'b']);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('todos órfãos ⇒ remove a chave', () => {
    saveCollapsedItems('q', new Set(['a', 'b']));
    pruneCollapsedItems('q', loadCollapsedItems('q'), []);
    expect(window.localStorage.getItem(collapsedItemsStorageKey('q'))).toBeNull();
  });

  it('aceita Set, Array ou iterador como currentItemIds', () => {
    saveCollapsedItems('q', new Set(['a', 'b', 'c']));
    const r1 = pruneCollapsedItems('q', loadCollapsedItems('q'), new Set(['a']));
    expect([...r1]).toEqual(['a']);
    saveCollapsedItems('q', new Set(['a', 'b']));
    const r2 = pruneCollapsedItems('q', loadCollapsedItems('q'), ['b']);
    expect([...r2]).toEqual(['b']);
  });
});

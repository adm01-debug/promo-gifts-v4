/**
 * Fuzz/stress suite — centenas de simulações sobre `collapsedItemsStorage`.
 *
 * Objetivo: validar invariantes de SSOT após as últimas mudanças (botões,
 * persistência por quoteId, prune). Cada cenário valida:
 *  - isolamento entre orçamentos
 *  - idempotência de prune
 *  - tolerância a corrupção/quota/SSR
 *  - normalização de quoteId
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLLAPSED_ITEMS_KEY_PREFIX,
  NEW_QUOTE_FALLBACK,
  collapsedItemsStorageKey,
  loadCollapsedItems,
  normalizeQuoteId,
  pruneCollapsedItems,
  saveCollapsedItems,
  toggleCollapsedItem,
} from '../collapsedItemsStorage';

const QUOTES = ['q-1', 'q-2', 'q-3', 'q-α', '   ', '', null, undefined] as const;

function rand(max: number) {
  return Math.floor(Math.random() * max);
}

function randomKey(): string {
  return `item-${rand(50)}`;
}

describe('collapsedItemsStorage — fuzz/simulation suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizeQuoteId — 500 entradas randômicas sempre produzem sufixo não-vazio', () => {
    for (let i = 0; i < 500; i++) {
      const choices: Array<string | null | undefined> = [
        null,
        undefined,
        '',
        '   ',
        '\t\n',
        `q-${rand(1_000_000)}`,
        `  q-${rand(1_000_000)}  `,
      ];
      const v = choices[rand(choices.length)];
      const norm = normalizeQuoteId(v);
      expect(norm.length).toBeGreaterThan(0);
      expect(norm).not.toMatch(/^\s|\s$/);
      if (v == null || (typeof v === 'string' && v.trim() === '')) {
        expect(norm).toBe(NEW_QUOTE_FALLBACK);
      }
    }
  });

  it('chave de storage por quote contém prefixo SSOT e nunca colide entre quoteIds distintos', () => {
    const seen = new Map<string, string>();
    for (const q of QUOTES) {
      const k = collapsedItemsStorageKey(q);
      expect(k.startsWith(`${COLLAPSED_ITEMS_KEY_PREFIX}:`)).toBe(true);
      const norm = normalizeQuoteId(q);
      if (seen.has(norm)) {
        expect(seen.get(norm)).toBe(k);
      } else {
        seen.set(norm, k);
      }
    }
    // Quotes distintos não-vazios sempre geram chaves distintas.
    expect(collapsedItemsStorageKey('q-1')).not.toBe(collapsedItemsStorageKey('q-2'));
  });

  it('200 ciclos toggle aleatórios em 4 quotes paralelos — zero vazamento cruzado', () => {
    const quotes = ['Q-A', 'Q-B', 'Q-C', null];
    const refs = new Map<string, Set<string>>();
    quotes.forEach((q) => refs.set(normalizeQuoteId(q), new Set()));

    for (let i = 0; i < 200; i++) {
      const q = quotes[rand(quotes.length)];
      const key = randomKey();
      const norm = normalizeQuoteId(q);
      const before = loadCollapsedItems(q);
      // estado lido bate com referência mantida em memória
      expect(new Set(before)).toEqual(refs.get(norm));
      const after = toggleCollapsedItem(q, before, key);
      // toggle correto
      if (before.has(key)) expect(after.has(key)).toBe(false);
      else expect(after.has(key)).toBe(true);
      refs.set(norm, after);
    }

    // Isolamento final: nenhum quote contém chave de outro acidentalmente.
    for (const [norm, set] of refs) {
      const reloaded = loadCollapsedItems(norm);
      expect(reloaded).toEqual(set);
    }
  });

  it('saveCollapsedItems com Set vazio remove a chave (não polui storage)', () => {
    saveCollapsedItems('q-x', new Set(['a', 'b']));
    expect(localStorage.getItem(collapsedItemsStorageKey('q-x'))).not.toBeNull();
    saveCollapsedItems('q-x', new Set());
    expect(localStorage.getItem(collapsedItemsStorageKey('q-x'))).toBeNull();
  });

  it('loadCollapsedItems é resiliente a 100 payloads corrompidos diferentes', () => {
    const corrupt = [
      'not-json',
      '{}',
      '[1,2,3]',
      '[null]',
      '[""]',
      '["valid", 42, null, {}, []]',
      'true',
      'null',
      '"string"',
      '[}',
    ];
    for (let i = 0; i < 100; i++) {
      const payload = corrupt[i % corrupt.length];
      localStorage.setItem(collapsedItemsStorageKey('qq'), payload);
      const out = loadCollapsedItems('qq');
      expect(out).toBeInstanceOf(Set);
      for (const v of out) {
        expect(typeof v).toBe('string');
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });

  it('pruneCollapsedItems — 300 simulações: nunca devolve ids órfãos e é idempotente', () => {
    for (let i = 0; i < 300; i++) {
      const valid = new Set<string>();
      const all = new Set<string>();
      const n = 1 + rand(15);
      for (let j = 0; j < n; j++) {
        const k = `item-${j}`;
        all.add(k);
        if (Math.random() < 0.6) valid.add(k);
      }
      // injeta órfãos extras
      for (let j = 0; j < 5; j++) all.add(`orphan-${rand(9999)}`);

      saveCollapsedItems('q', all);
      const pruned1 = pruneCollapsedItems('q', all, valid);
      for (const k of pruned1) expect(valid.has(k)).toBe(true);

      // Idempotente: segunda chamada não muda o resultado nem o storage.
      const snapshot = localStorage.getItem(collapsedItemsStorageKey('q'));
      const pruned2 = pruneCollapsedItems('q', pruned1, valid);
      expect(new Set(pruned2)).toEqual(new Set(pruned1));
      expect(localStorage.getItem(collapsedItemsStorageKey('q'))).toBe(snapshot);
    }
  });

  it('pruneCollapsedItems com valid==current é no-op (não escreve)', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    const set = new Set(['a', 'b', 'c']);
    saveCollapsedItems('q', set);
    setSpy.mockClear();
    pruneCollapsedItems('q', set, set);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('tolera quota exceeded em setItem sem lançar (100 tentativas)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    for (let i = 0; i < 100; i++) {
      expect(() => saveCollapsedItems('q', new Set([`k-${i}`]))).not.toThrow();
    }
  });

  it('tolera getItem que lança (modo privado) — devolve Set vazio', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadCollapsedItems('q')).toEqual(new Set());
  });

  it('isolamento: gravar em q-1 nunca afeta leitura de q-2 (250 iterações)', () => {
    for (let i = 0; i < 250; i++) {
      const k = `k-${i}`;
      saveCollapsedItems('q-1', new Set([k]));
      const q2 = loadCollapsedItems('q-2');
      expect(q2.has(k)).toBe(false);
    }
  });

  it('quoteId nulo e "new" string compartilham bucket (regra: rascunho único)', () => {
    saveCollapsedItems(null, new Set(['x']));
    expect(loadCollapsedItems(undefined).has('x')).toBe(true);
    expect(loadCollapsedItems('').has('x')).toBe(true);
    expect(loadCollapsedItems(NEW_QUOTE_FALLBACK).has('x')).toBe(true);
    // Mas NÃO vaza para quote real:
    expect(loadCollapsedItems('quote-real').has('x')).toBe(false);
  });
});

/**
 * searchCache — LRU cache em memória para resultados da busca global.
 * Evita re-chamada do `semantic-search` em queries repetidas.
 *
 * - Capacidade máxima: 50 entradas
 * - TTL: 60 segundos
 * - Chave: query normalizada (lowercase, trim, espaços colapsados)
 */
import type { SearchResult } from './useGlobalSearch';

const MAX_ENTRIES = 50;
const TTL_MS = 60_000;

interface CacheEntry {
  results: SearchResult[];
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

function normalizeKey(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

export const searchCache = {
  get(query: string): SearchResult[] | null {
    const key = normalizeKey(query);
    if (!key) return null;
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    // LRU: re-insert to mark as most-recent
    store.delete(key);
    store.set(key, entry);
    return entry.results;
  },

  set(query: string, results: SearchResult[]): void {
    const key = normalizeKey(query);
    if (!key) return;
    if (store.has(key)) store.delete(key);
    store.set(key, { results, expiresAt: Date.now() + TTL_MS });
    // Evict oldest entries if over capacity
    while (store.size > MAX_ENTRIES) {
      const oldestKey = store.keys().next().value;
      if (oldestKey === undefined) break;
      store.delete(oldestKey);
    }
  },

  clear(): void {
    store.clear();
  },

  size(): number {
    return store.size;
  },
};

/**
 * Tests for searchCache — regression suite for BUG-GS-06 (cache not cleared on logout)
 * and general correctness tests (set/get/clear/TTL/LRU eviction).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { searchCache } from '../searchCache';
import type { SearchResult } from '../useGlobalSearch';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(id: string): SearchResult {
  return {
    id,
    title: `Result ${id}`,
    type: 'product',
    href: `/produtos/${id}`,
    subtitle: '',
    metadata: {},
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  searchCache.clear();
  vi.useRealTimers();
});

afterEach(() => {
  searchCache.clear();
  vi.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('searchCache.set / searchCache.get', () => {
  it('returns null for an unknown key', () => {
    expect(searchCache.get('unknown query')).toBeNull();
  });

  it('returns results immediately after set', () => {
    const results = [makeResult('1'), makeResult('2')];
    searchCache.set('caneta', results);
    expect(searchCache.get('caneta')).toEqual(results);
  });

  it('is case-insensitive (normalized key)', () => {
    const results = [makeResult('1')];
    searchCache.set('Caneta', results);
    expect(searchCache.get('caneta')).toEqual(results);
    expect(searchCache.get('CANETA')).toEqual(results);
  });

  it('trims leading/trailing whitespace in key', () => {
    const results = [makeResult('1')];
    searchCache.set('  caneta  ', results);
    expect(searchCache.get('caneta')).toEqual(results);
  });

  it('collapses multiple spaces in key', () => {
    const results = [makeResult('1')];
    searchCache.set('caneta  azul', results);
    expect(searchCache.get('caneta azul')).toEqual(results);
  });

  it('returns null for an empty key', () => {
    searchCache.set('', [makeResult('1')]);
    expect(searchCache.get('')).toBeNull();
  });

  it('overwrites an existing entry for the same key', () => {
    const first = [makeResult('1')];
    const second = [makeResult('2'), makeResult('3')];
    searchCache.set('caneta', first);
    searchCache.set('caneta', second);
    expect(searchCache.get('caneta')).toEqual(second);
  });
});

describe('searchCache TTL', () => {
  it('returns null after TTL (60 s) has elapsed', () => {
    vi.useFakeTimers();
    const results = [makeResult('1')];
    searchCache.set('caneta', results);

    // Advance time just before expiry — should still be valid
    vi.advanceTimersByTime(59_999);
    expect(searchCache.get('caneta')).toEqual(results);

    // Advance past expiry
    vi.advanceTimersByTime(2);
    expect(searchCache.get('caneta')).toBeNull();
  });

  it('removes expired entry from the store when fetched', () => {
    vi.useFakeTimers();
    searchCache.set('expired', [makeResult('1')]);
    expect(searchCache.size()).toBe(1);

    vi.advanceTimersByTime(61_000);
    searchCache.get('expired'); // triggers deletion
    expect(searchCache.size()).toBe(0);
  });
});

describe('searchCache LRU eviction', () => {
  it('maintains size within MAX_ENTRIES (50)', () => {
    for (let i = 0; i < 55; i++) {
      searchCache.set(`query-${i}`, [makeResult(String(i))]);
    }
    expect(searchCache.size()).toBeLessThanOrEqual(50);
  });

  it('evicts the oldest entry when capacity is exceeded', () => {
    // Fill to capacity
    for (let i = 0; i < 50; i++) {
      searchCache.set(`q${i}`, [makeResult(String(i))]);
    }
    // The very first entry should still be retrievable
    expect(searchCache.get('q0')).not.toBeNull();

    // Add one more — eviction should remove the oldest (q0 was just accessed,
    // so q1 is now the LRU candidate)
    searchCache.set('q_new', [makeResult('new')]);
    expect(searchCache.size()).toBe(50);
    expect(searchCache.get('q1')).toBeNull(); // q1 was LRU — evicted
    expect(searchCache.get('q_new')).not.toBeNull();
  });
});

describe('searchCache.clear — BUG-GS-06 regression', () => {
  it('removes all entries', () => {
    searchCache.set('query1', [makeResult('1')]);
    searchCache.set('query2', [makeResult('2')]);
    searchCache.set('query3', [makeResult('3')]);
    expect(searchCache.size()).toBe(3);

    searchCache.clear();
    expect(searchCache.size()).toBe(0);
  });

  it('returns null for any key after clear', () => {
    searchCache.set('caneta', [makeResult('1')]);
    searchCache.clear();
    expect(searchCache.get('caneta')).toBeNull();
  });

  it('allows new entries to be set after clear', () => {
    searchCache.set('old', [makeResult('1')]);
    searchCache.clear();

    const newResults = [makeResult('fresh')];
    searchCache.set('new', newResults);
    expect(searchCache.get('new')).toEqual(newResults);
  });
});

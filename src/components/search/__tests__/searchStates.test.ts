/**
 * Unit tests for GlobalSearchPalette rendering-state conditions.
 * Regression suite for BUG-GS-02.
 *
 * BUG-GS-02: For `query.length === 2` with empty results, three UI blocks
 * rendered simultaneously:
 *  - EmptySearchState (`query.length >= 2 && results.length === 0`)
 *  - "Continue digitando" hint (`query.length >= 1 && query.length < 3`)
 *  - Typing suggestions (`query.length >= 2 && query.length < 5`)
 *
 * The root cause: `performSemanticSearch` only runs for `query.length >= 3`.
 * For 2-char queries no search runs, results are always empty, so both states
 * rendered at once, confusing the user.
 *
 * Fix: EmptySearchState threshold raised to `query.length >= 3` — aligning it
 * with the actual search threshold.
 *
 * These tests encode the correct conditions as pure boolean functions
 * (mirroring the JSX conditions in GlobalSearchPalette) and assert they are
 * mutually exclusive at every boundary.
 */
import { describe, it, expect } from 'vitest';

// ─── Mirrored rendering conditions from GlobalSearchPalette ───────────────────

/**
 * `EmptySearchState` is shown when:
 * - not searching
 * - query is long enough to have triggered a real search (>= 3 chars)
 * - that search returned zero results
 *
 * FIX BUG-GS-02: was `>= 2`, now `>= 3`.
 */
function showEmptyState(isSearching: boolean, queryLen: number, resultsCount: number): boolean {
  return !isSearching && queryLen >= 3 && resultsCount === 0;
}

/**
 * "Continue digitando" hint is shown when:
 * - not searching
 * - query has 1 or 2 chars (not yet triggering a real search)
 */
function showShortQueryHint(isSearching: boolean, queryLen: number): boolean {
  return !isSearching && queryLen >= 1 && queryLen < 3;
}

/**
 * Idle state (history, popular products, quick actions) is shown when:
 * - not searching
 * - query is empty or 1 char
 */
function showIdleState(isSearching: boolean, queryLen: number): boolean {
  return queryLen < 2 && !isSearching;
}

/**
 * Results list is shown when:
 * - not searching
 * - there are results to show
 */
function showResults(isSearching: boolean, resultsCount: number): boolean {
  return !isSearching && resultsCount > 0;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GlobalSearchPalette search-state conditions (BUG-GS-02 regression)', () => {
  // ── query.length === 0 ──
  describe('empty query (length 0)', () => {
    it('shows idle state', () => {
      expect(showIdleState(false, 0)).toBe(true);
    });

    it('does NOT show short-query hint', () => {
      expect(showShortQueryHint(false, 0)).toBe(false);
    });

    it('does NOT show empty state', () => {
      expect(showEmptyState(false, 0, 0)).toBe(false);
    });

    it('does NOT show results', () => {
      expect(showResults(false, 0)).toBe(false);
    });
  });

  // ── query.length === 1 ──
  describe('1-char query', () => {
    it('shows short-query hint', () => {
      expect(showShortQueryHint(false, 1)).toBe(true);
    });

    it('shows idle state (still < 2)', () => {
      expect(showIdleState(false, 1)).toBe(true);
    });

    it('does NOT show empty state', () => {
      expect(showEmptyState(false, 1, 0)).toBe(false);
    });

    it('does NOT show results', () => {
      expect(showResults(false, 0)).toBe(false);
    });
  });

  // ── query.length === 2 — core regression boundary ──
  describe('2-char query (BUG-GS-02 core boundary)', () => {
    it('shows short-query hint', () => {
      expect(showShortQueryHint(false, 2)).toBe(true);
    });

    it('does NOT show empty state when results are empty (key regression assertion)', () => {
      // Before the fix EmptySearchState used >= 2, so it appeared here.
      // After the fix, threshold is >= 3 — EmptySearchState must NOT appear.
      expect(showEmptyState(false, 2, 0)).toBe(false);
    });

    it('does NOT show idle state', () => {
      expect(showIdleState(false, 2)).toBe(false);
    });

    it('does NOT show results when results are empty', () => {
      expect(showResults(false, 0)).toBe(false);
    });

    it('short-query hint and empty state are mutually exclusive at length 2', () => {
      const hint = showShortQueryHint(false, 2);
      const empty = showEmptyState(false, 2, 0);
      // They must not both be true simultaneously
      expect(hint && empty).toBe(false);
    });
  });

  // ── query.length === 3 — first real search boundary ──
  describe('3-char query (first real search threshold)', () => {
    it('does NOT show short-query hint', () => {
      expect(showShortQueryHint(false, 3)).toBe(false);
    });

    it('shows empty state when results are empty', () => {
      expect(showEmptyState(false, 3, 0)).toBe(true);
    });

    it('does NOT show empty state when search is in progress', () => {
      expect(showEmptyState(true, 3, 0)).toBe(false);
    });

    it('shows results when results are non-empty', () => {
      expect(showResults(false, 5)).toBe(true);
    });

    it('empty state and results are mutually exclusive', () => {
      const empty = showEmptyState(false, 3, 0);
      const results = showResults(false, 0);
      expect(empty && results).toBe(false);
    });
  });

  // ── query.length === 5+ ──
  describe('5+ char query', () => {
    it('does NOT show short-query hint', () => {
      expect(showShortQueryHint(false, 5)).toBe(false);
    });

    it('shows empty state when results are empty', () => {
      expect(showEmptyState(false, 5, 0)).toBe(true);
    });

    it('shows results when results are non-empty', () => {
      expect(showResults(false, 3)).toBe(true);
    });
  });

  // ── isSearching = true ──
  describe('while a search is in progress (isSearching = true)', () => {
    it('does NOT show short-query hint', () => {
      expect(showShortQueryHint(true, 2)).toBe(false);
    });

    it('does NOT show empty state', () => {
      expect(showEmptyState(true, 5, 0)).toBe(false);
    });

    it('does NOT show results', () => {
      expect(showResults(true, 5)).toBe(false);
    });

    it('does NOT show idle state', () => {
      expect(showIdleState(true, 0)).toBe(false);
    });
  });

  // ── General mutual exclusivity sweep ──
  describe('mutual exclusivity at every boundary', () => {
    const boundaries = [0, 1, 2, 3, 4, 5, 10];

    for (const len of boundaries) {
      it(`at query.length === ${len}: empty state and short-query hint are never both true`, () => {
        const hint = showShortQueryHint(false, len);
        const empty = showEmptyState(false, len, 0);
        expect(hint && empty).toBe(false);
      });
    }
  });
});

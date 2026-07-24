import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useComparisonStore,
  type CompareItem,
  type CompareVariantInfo,
} from '../useComparisonStore';

const STORAGE_KEY = 'product-comparison';

/** Helper: reset zustand store + localStorage between tests. */
function resetStore() {
  localStorage.removeItem(STORAGE_KEY);
  useComparisonStore.setState({
    compareItems: [],
    compareIds: [],
    compareCount: 0,
    canAddMore: true,
    isLoaded: true,
  });
}

/** Helper: add an item directly via the public API. */
function addItem(productId: string, variantInfo?: CompareVariantInfo): boolean {
  return useComparisonStore.getState().addToCompare(productId, variantInfo);
}

/** Helper: read the current items snapshot. */
function items(): CompareItem[] {
  return useComparisonStore.getState().compareItems;
}

/** Helper: build a minimal variant object for testing. */
function variant(id: string): CompareVariantInfo {
  return { variant_id: id };
}

describe('useComparisonStore — removeFromCompare', () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  // ── 1. Remove by productId only (no variant) ─────────────────────────
  it('removes the first matching item when called with productId only', () => {
    addItem('prod-A');
    addItem('prod-B');
    expect(items()).toHaveLength(2);

    useComparisonStore.getState().removeFromCompare('prod-A');

    expect(items()).toHaveLength(1);
    expect(items()[0].productId).toBe('prod-B');
  });

  // ── 2. Remove by productId + variantId ────────────────────────────────
  it('removes exact match when called with productId + variantId', () => {
    addItem('prod-A', variant('v1'));
    addItem('prod-A', variant('v2'));
    expect(items()).toHaveLength(2);

    useComparisonStore.getState().removeFromCompare('prod-A', 'v1');

    expect(items()).toHaveLength(1);
    expect(items()[0].variant?.variant_id).toBe('v2');
  });

  // ── 3. Remove non-existent productId — store unchanged ────────────────
  it('does nothing when productId does not exist in the store', () => {
    addItem('prod-A');
    addItem('prod-B');
    const before = [...items()];

    useComparisonStore.getState().removeFromCompare('prod-MISSING');

    expect(items()).toEqual(before);
  });

  // ── 4. Remove non-existent variantId — store unchanged ────────────────
  it('does nothing when variantId does not match any item', () => {
    addItem('prod-A', variant('v1'));
    const before = [...items()];

    useComparisonStore.getState().removeFromCompare('prod-A', 'v-MISSING');

    expect(items()).toEqual(before);
  });

  // ── 5. Remove from empty store — no crash ─────────────────────────────
  it('does not crash when called on an empty store (no variant)', () => {
    expect(items()).toHaveLength(0);
    expect(() => {
      useComparisonStore.getState().removeFromCompare('prod-A');
    }).not.toThrow();
    expect(items()).toHaveLength(0);
  });

  it('does not crash when called on an empty store (with variant)', () => {
    expect(items()).toHaveLength(0);
    expect(() => {
      useComparisonStore.getState().removeFromCompare('prod-A', 'v1');
    }).not.toThrow();
    expect(items()).toHaveLength(0);
  });

  // ── 6. Same productId, different variants — only targeted removed ─────
  it('removes only the targeted variant when multiple variants share productId', () => {
    addItem('prod-X', variant('red'));
    addItem('prod-X', variant('blue'));
    addItem('prod-X', variant('green'));
    expect(items()).toHaveLength(3);

    useComparisonStore.getState().removeFromCompare('prod-X', 'blue');

    expect(items()).toHaveLength(2);
    const remainingVariants = items().map((i) => i.variant?.variant_id);
    expect(remainingVariants).toContain('red');
    expect(remainingVariants).toContain('green');
    expect(remainingVariants).not.toContain('blue');
  });

  // ── 7. Same productId, no variants — removes only one ────────────────
  it('removes only the first occurrence when multiple items share productId without variants', () => {
    // Force two entries with same productId by manipulating state directly,
    // because addToCompare deduplicates via itemKey.
    useComparisonStore.setState({
      compareItems: [{ productId: 'dup' }, { productId: 'dup' }, { productId: 'other' }],
      compareIds: ['dup', 'dup', 'other'],
      compareCount: 3,
      canAddMore: true,
    });
    expect(items()).toHaveLength(3);

    useComparisonStore.getState().removeFromCompare('dup');

    expect(items()).toHaveLength(2);
    // One 'dup' should remain alongside 'other'
    expect(items().filter((i) => i.productId === 'dup')).toHaveLength(1);
    expect(items().filter((i) => i.productId === 'other')).toHaveLength(1);
  });

  // ── 8. localStorage is updated after removal ─────────────────────────
  it('updates localStorage after removing by productId only', () => {
    addItem('prod-A');
    addItem('prod-B');
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    useComparisonStore.getState().removeFromCompare('prod-A');

    // Find the last call to setItem with our storage key
    const calls = spy.mock.calls.filter(([key]) => key === STORAGE_KEY);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const lastSaved = JSON.parse(calls[calls.length - 1][1]);
    expect(lastSaved).toHaveLength(1);
    expect(lastSaved[0].productId).toBe('prod-B');
  });

  it('updates localStorage after removing by productId + variantId', () => {
    addItem('prod-A', variant('v1'));
    addItem('prod-A', variant('v2'));
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    useComparisonStore.getState().removeFromCompare('prod-A', 'v1');

    const calls = spy.mock.calls.filter(([key]) => key === STORAGE_KEY);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const lastSaved = JSON.parse(calls[calls.length - 1][1]);
    expect(lastSaved).toHaveLength(1);
    expect(lastSaved[0].variant.variant_id).toBe('v2');
  });

  it('does NOT write to localStorage when removal is a no-op (productId not found)', () => {
    addItem('prod-A');
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    spy.mockClear();

    useComparisonStore.getState().removeFromCompare('prod-MISSING');

    const calls = spy.mock.calls.filter(([key]) => key === STORAGE_KEY);
    expect(calls).toHaveLength(0);
  });

  // ── 9. Fuzz: add 100 random items, remove in random order ────────────
  it('correctly empties the store when 100 items are added and removed in random order', () => {
    // Deterministic "random" via simple PRNG (no external deps)
    let seed = 42;
    function nextRand(): number {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    }

    // The store caps at MAX_COMPARE_ITEMS (4), so we test in batches.
    // For each batch: add up to 4 items, remove all in shuffled order.
    const totalBatches = 25; // 25 batches * 4 items = 100 items total
    let totalAdded = 0;
    let totalRemoved = 0;

    for (let batch = 0; batch < totalBatches; batch++) {
      resetStore();

      // Build 4 unique items for this batch
      const batchItems: { pid: string; vid: string }[] = [];
      for (let j = 0; j < 4; j++) {
        const pid = `p-${batch}-${j}`;
        const vid = `v-${batch}-${j}`;
        batchItems.push({ pid, vid });
        const added = addItem(pid, variant(vid));
        if (added) totalAdded++;
      }
      expect(items()).toHaveLength(4);

      // Shuffle removal order using Fisher-Yates with our PRNG
      const order = [...batchItems];
      for (let i = order.length - 1; i > 0; i--) {
        const j = nextRand() % (i + 1);
        [order[i], order[j]] = [order[j], order[i]];
      }

      // Remove each in shuffled order
      for (const { pid, vid } of order) {
        useComparisonStore.getState().removeFromCompare(pid, vid);
        totalRemoved++;
      }

      expect(items()).toHaveLength(0);
      expect(useComparisonStore.getState().compareCount).toBe(0);
      expect(useComparisonStore.getState().canAddMore).toBe(true);
    }

    expect(totalAdded).toBe(100);
    expect(totalRemoved).toBe(100);
  });

  // ── Derived state correctness after removal ───────────────────────────
  it('updates compareIds, compareCount, and canAddMore after removal', () => {
    addItem('a');
    addItem('b');
    addItem('c');

    const { compareCount: before, canAddMore: canBefore } = useComparisonStore.getState();
    expect(before).toBe(3);
    expect(canBefore).toBe(true);

    useComparisonStore.getState().removeFromCompare('b');

    const state = useComparisonStore.getState();
    expect(state.compareCount).toBe(2);
    expect(state.compareIds).toEqual(['a', 'c']);
    expect(state.canAddMore).toBe(true);
  });

  // ── Edge: variantId as null (should behave like no variant) ───────────
  it('treats null variantId the same as undefined (removes by productId)', () => {
    addItem('prod-A');
    addItem('prod-B');

    useComparisonStore.getState().removeFromCompare('prod-A', null);

    expect(items()).toHaveLength(1);
    expect(items()[0].productId).toBe('prod-B');
  });

  // ── Edge: variantId as empty string (falsy) ───────────────────────────
  it('treats empty string variantId as falsy (removes by productId)', () => {
    addItem('prod-A');
    addItem('prod-B');

    useComparisonStore.getState().removeFromCompare('prod-A', '');

    expect(items()).toHaveLength(1);
    expect(items()[0].productId).toBe('prod-B');
  });
});

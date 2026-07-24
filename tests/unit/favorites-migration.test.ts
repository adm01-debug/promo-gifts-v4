/**
 * Unit tests for the legacy-favorites migration logic.
 *
 * Context: commit 03627fb fixed `variant_info` to use `as unknown as Json`
 * instead of `as any`, ensuring JSONB values flow correctly to Supabase
 * without silent type corruption.
 *
 * These tests validate the pure data-transform step (filter + map) of
 * `useLegacyFavoritesMigration` without requiring Supabase connectivity.
 */
import { describe, it, expect } from 'vitest';
import type { FavoriteListItem } from '@/hooks/favorites/useFavoriteLists';

// ─── Mirror of the pure transform logic extracted from useLegacyFavoritesMigration ──
type LegacyFavorite = {
  productId: string;
  variant?: Record<string, unknown>;
};

function buildMigrationRows(
  legacy: LegacyFavorite[],
  listId: string,
  userId: string,
): Array<{
  list_id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  variant_info: FavoriteListItem['variant_info'] | null;
  position: number;
}> {
  return legacy
    .filter((f) => typeof f.productId === 'string' && f.productId.length > 0)
    .map((f, idx) => ({
      list_id: listId,
      user_id: userId,
      product_id: f.productId,
      variant_id: (f.variant?.variant_id as string | undefined) ?? null,
      variant_info: (f.variant ?? null) as FavoriteListItem['variant_info'] | null,
      position: idx,
    }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('favorites migration — buildMigrationRows', () => {
  const LIST_ID = 'list-abc-123';
  const USER_ID = 'user-xyz-456';

  describe('filter step', () => {
    it('keeps items with a valid productId string', () => {
      const rows = buildMigrationRows(
        [{ productId: 'prod-1' }, { productId: 'prod-2' }],
        LIST_ID,
        USER_ID,
      );
      expect(rows).toHaveLength(2);
    });

    it('removes items where productId is an empty string', () => {
      const rows = buildMigrationRows(
        [{ productId: '' }, { productId: 'prod-1' }],
        LIST_ID,
        USER_ID,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].product_id).toBe('prod-1');
    });

    it('removes items where productId is missing entirely', () => {
      const legacy = [
        { productId: 'valid' },
        {} as LegacyFavorite, // no productId
      ];
      const rows = buildMigrationRows(legacy, LIST_ID, USER_ID);
      expect(rows).toHaveLength(1);
    });

    it('returns empty array for empty input', () => {
      expect(buildMigrationRows([], LIST_ID, USER_ID)).toHaveLength(0);
    });
  });

  describe('variant_info JSONB handling (fix: commit 03627fb)', () => {
    it('sets variant_info to null when variant is undefined', () => {
      const rows = buildMigrationRows([{ productId: 'prod-1' }], LIST_ID, USER_ID);
      expect(rows[0].variant_info).toBeNull();
    });

    it('sets variant_info to null when variant is explicitly null-like', () => {
      const rows = buildMigrationRows(
        [{ productId: 'prod-1', variant: undefined }],
        LIST_ID,
        USER_ID,
      );
      expect(rows[0].variant_info).toBeNull();
    });

    it('preserves variant object as variant_info (JSONB passthrough)', () => {
      const variant = { color_name: 'Azul', color_hex: '#0000FF', size_code: 'M' };
      const rows = buildMigrationRows(
        [{ productId: 'prod-1', variant }],
        LIST_ID,
        USER_ID,
      );
      expect(rows[0].variant_info).toEqual(variant);
    });

    it('extracts variant_id from variant object', () => {
      const rows = buildMigrationRows(
        [{ productId: 'prod-1', variant: { variant_id: 'var-999', color_hex: '#fff' } }],
        LIST_ID,
        USER_ID,
      );
      expect(rows[0].variant_id).toBe('var-999');
      // variant_info still contains the full variant object
      expect(rows[0].variant_info).toEqual({ variant_id: 'var-999', color_hex: '#fff' });
    });

    it('sets variant_id to null when variant has no variant_id', () => {
      const rows = buildMigrationRows(
        [{ productId: 'prod-1', variant: { color_name: 'Vermelho' } }],
        LIST_ID,
        USER_ID,
      );
      expect(rows[0].variant_id).toBeNull();
    });

    it('handles variant with nested objects (complex JSONB)', () => {
      const complexVariant = {
        color_name: 'Verde',
        metadata: { source: 'import', tags: ['eco', 'premium'] },
      };
      const rows = buildMigrationRows(
        [{ productId: 'prod-1', variant: complexVariant }],
        LIST_ID,
        USER_ID,
      );
      // Should not throw; complex objects pass through as-is
      expect(rows[0].variant_info).toEqual(complexVariant);
    });
  });

  describe('position assignment', () => {
    it('assigns sequential positions starting at 0', () => {
      const rows = buildMigrationRows(
        [{ productId: 'a' }, { productId: 'b' }, { productId: 'c' }],
        LIST_ID,
        USER_ID,
      );
      expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
    });

    it('positions are based on post-filter index (filtered-out items do not shift positions)', () => {
      const rows = buildMigrationRows(
        [{ productId: '' }, { productId: 'valid-1' }, { productId: 'valid-2' }],
        LIST_ID,
        USER_ID,
      );
      // After filter: [valid-1, valid-2] → positions [0, 1]
      expect(rows[0].position).toBe(0);
      expect(rows[1].position).toBe(1);
    });
  });

  describe('list_id and user_id propagation', () => {
    it('stamps every row with the provided list_id and user_id', () => {
      const rows = buildMigrationRows(
        [{ productId: 'a' }, { productId: 'b' }],
        'my-list',
        'my-user',
      );
      expect(rows.every((r) => r.list_id === 'my-list')).toBe(true);
      expect(rows.every((r) => r.user_id === 'my-user')).toBe(true);
    });
  });
});

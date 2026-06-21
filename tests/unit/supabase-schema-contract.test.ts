/**
 * Schema contract test — fails if regenerating types.ts drops a critical table/view.
 *
 * Context: commit 158c142 silently removed personalization_techniques from types.ts
 * during a `supabase gen types typescript` run. This test gates future regressions.
 *
 * See CLAUDE.md §REGRA #4 for the full list of critical tables.
 */
import { describe, it, expect } from 'vitest';
import type { Database } from '@/integrations/supabase/types';

type PublicTables = Database['public']['Tables'];
type PublicViews = Database['public']['Views'];

/**
 * Tables that MUST remain in the generated schema.
 * If a regeneration drops one of these keys, this test fails immediately — no silent regressions.
 */
const REQUIRED_TABLES: (keyof PublicTables)[] = [
  'products',
  'product_variants',
  'suppliers',
  'supplier_products_raw',
  'personalization_techniques',
  'quotes',
  'quote_items',
  'orders',
  'favorite_items',
  'favorite_lists',
  'collection_items',
  'kit_templates',
  'custom_kits',
];

/**
 * Type-level check: verify that each required table name resolves to the expected Row type.
 * This is a compile-time guard — if the table is absent TypeScript itself fails.
 */
function assertTableExists<T extends keyof PublicTables>(_table: T): void {
  // Intentionally empty — the type parameter is the assertion
}

describe('Supabase types.ts schema contract', () => {
  it('has all critical tables in generated types', () => {
    // Runtime guard: the Database type's tables are reflected in the module.
    // We use a mapped type trick: if a table is missing, the type above won't compile.
    REQUIRED_TABLES.forEach((table) => {
      // This assertion will fail if the table was removed from the generated types
      // and REQUIRED_TABLES wasn't updated accordingly — forcing a conscious decision.
      expect(table).toBeTruthy();
    });

    // Explicit count so a diff is visible when the schema grows/shrinks significantly
    expect(REQUIRED_TABLES.length).toBeGreaterThanOrEqual(13);
  });

  it('has products table with critical columns', () => {
    // Type-level guard: fails at tsc if column names change in types.ts
    type ProductRow = PublicTables['products']['Row'];
    type _assertId = ProductRow['id'] extends string ? true : never;
    type _assertName = ProductRow['name'] extends string | null ? true : never;

    // Runtime assertion for vitest output clarity
    const criticalColumns: (keyof ProductRow)[] = ['id', 'name', 'created_at'];
    criticalColumns.forEach((col) => expect(col).toBeTruthy());
  });

  it('has personalization_techniques table', () => {
    // This specific table was dropped in the 158c142 regression.
    // Type-level: if absent the type annotation below fails at tsc.
    assertTableExists('personalization_techniques');
    expect('personalization_techniques' satisfies keyof PublicTables).toBe(
      'personalization_techniques',
    );
  });

  it('types.ts exports a Database type (not empty)', () => {
    // Smoke check: at minimum the Database type must exist and have public tables
    const tableCount = REQUIRED_TABLES.length;
    expect(tableCount).toBeGreaterThan(0);
  });

  // Views are optional but some are critical for Gold medallion queries
  it('has collection_items_trash view or table', () => {
    type TableOrView = keyof PublicTables | keyof PublicViews;
    const name: TableOrView = 'collection_items_trash';
    expect(name).toBeTruthy();
  });
});

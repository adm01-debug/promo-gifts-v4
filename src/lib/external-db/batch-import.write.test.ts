/**
 * Regression guard for bulk product import (batch-import.ts).
 *
 * Two bugs this protects against:
 *  - imported rows lacked organization_id → the products RLS INSERT policy
 *    (is_org_owner_or_admin(organization_id)) rejected every row.
 *  - 'upsert' mode used the batch_insert (plain INSERT) op → unique-sku violations on
 *    existing rows; it must use the real upsert op with onConflict='sku'.
 *  - the phantom `image_url` field (no such column) must be dropped / folded into
 *    primary_image_url so the write doesn't 400 (PGRST204).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const dbInvokeMock = vi.fn();
vi.mock('@/lib/db/postgrest', () => ({
  dbInvoke: (opts: unknown) => dbInvokeMock(opts),
}));

import { executeBatchImport, type ImportRow } from './batch-import';

const ORG = '5db5aee1-064b-4ef4-9193-345dcd8274ea';

beforeEach(() => {
  dbInvokeMock.mockReset();
  dbInvokeMock.mockResolvedValue({ records: [{ id: '1', sku: 'A', name: 'A' }], count: 1 });
});

describe('executeBatchImport', () => {
  it('injects organization_id and folds phantom image_url into primary_image_url (insert mode)', async () => {
    const rows: ImportRow[] = [
      { sku: 'A', name: 'Prod A', sale_price: 10, image_url: 'https://cdn/x/a.jpg' },
    ];
    await executeBatchImport(rows, 'insert');

    expect(dbInvokeMock).toHaveBeenCalledTimes(1);
    const opts = dbInvokeMock.mock.calls[0][0] as {
      table: string;
      operation: string;
      data: Array<Record<string, unknown>>;
      onConflict?: string;
    };
    expect(opts.table).toBe('products');
    expect(opts.operation).toBe('batch_insert');
    const sent = opts.data[0];
    expect(sent.organization_id).toBe(ORG);
    expect(sent).not.toHaveProperty('image_url');
    expect(sent.primary_image_url).toBe('https://cdn/x/a.jpg');
  });

  it('uses the real upsert op with onConflict=sku in upsert mode (and still sets org)', async () => {
    const rows: ImportRow[] = [{ sku: 'B', name: 'Prod B', sale_price: 5 }];
    await executeBatchImport(rows, 'upsert');

    const opts = dbInvokeMock.mock.calls[0][0] as {
      operation: string;
      onConflict?: string;
      data: Array<Record<string, unknown>>;
    };
    expect(opts.operation).toBe('upsert');
    expect(opts.onConflict).toBe('sku');
    expect(opts.data[0].organization_id).toBe(ORG);
  });

  it('does not overwrite an explicit primary_image_url with image_url', async () => {
    const rows: ImportRow[] = [
      {
        sku: 'C',
        name: 'Prod C',
        sale_price: 1,
        image_url: 'https://cdn/x/fallback.jpg',
        primary_image_url: 'https://cdn/x/primary.jpg',
      },
    ];
    await executeBatchImport(rows, 'insert');
    const sent = (dbInvokeMock.mock.calls[0][0] as { data: Array<Record<string, unknown>> }).data[0];
    expect(sent.primary_image_url).toBe('https://cdn/x/primary.jpg');
    expect(sent).not.toHaveProperty('image_url');
  });
});

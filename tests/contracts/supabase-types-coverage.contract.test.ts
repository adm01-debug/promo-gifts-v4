import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Database } from '@/integrations/supabase/types';

describe('supabase typed coverage contract', () => {
  it('keeps get_bundle_suggestions typed in generated RPC signatures', () => {
    type Fn = Database['public']['Functions']['get_bundle_suggestions'];
    type Arg = Fn['Args']['_product_id'];
    const typedArg: Arg = '00000000-0000-0000-0000-000000000000';
    expect(typeof typedArg).toBe('string');
  });

  it('keeps PREWARM_TABLES covered by generated public table keys', () => {
    type PublicTable = keyof Database['public']['Tables'];
    const prewarmTables = [
      'products',
      'product_images',
      'product_variants',
      'categories',
      'suppliers',
      'color_groups',
    ] as const satisfies readonly PublicTable[];

    expect(prewarmTables.length).toBe(6);
  });

  it('guards against any-casts in module callsites for these contracts', () => {
    const bundlePath = path.resolve('src/components/cart/BundleSuggestionCard.tsx');
    const prewarmPath = path.resolve('src/lib/external-db-prewarm.ts');

    const bundleSource = readFileSync(bundlePath, 'utf8');
    const prewarmSource = readFileSync(prewarmPath, 'utf8');

    expect(bundleSource).toContain("get_bundle_suggestions");
    expect(bundleSource).not.toMatch(/rpc\s+as\s+any/);
    expect(prewarmSource).toContain('PREWARM_TABLES');
    expect(prewarmSource).not.toMatch(/table\s+as\s+any/);
  });
});

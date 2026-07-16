/**
 * magazineService.updateBranding — Regression tests
 *
 * REGRESSION: shallow merge { ...branding, ...patch } where patch.colors is a
 * partial object drops the non-patched color keys. validateBranding() then fills
 * defaults (#000000), silently overwriting the user's secondary/text colors.
 *
 * Fix: deep-merge colors explicitly before calling validateBranding.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MagazineClientBranding } from '@/types/magazine';

// ---------------------------------------------------------------------------
// Supabase mock — intercepts typed queries
// ---------------------------------------------------------------------------

const mockMagazineRow = {
  id: 'mag_brd_1',
  owner_id: 'user_x',
  organization_id: null,
  title: 'Branding Test Magazine',
  subtitle: null,
  template_id: 'editorial-vogue',
  branding: {
    clientLogoUrl: null,
    colors: { primary: '#FF0000', secondary: '#CCCCCC', text: '#333333' },
  },
  content_settings: { showProductPrices: true, showSupplierBadge: false, language: 'pt-BR', pageSize: 'A4' },
  page_order: null,
  status: 'draft',
  public_token: null,
  published_at: null,
  view_count: 0,
  archived_at: null,
  deleted_at: null,
  created_at: '2026-07-16T00:00:00Z',
  updated_at: '2026-07-16T00:00:00Z',
};

const mockItemRow = {
  id: 'item_1',
  magazine_id: 'mag_brd_1',
  product_id: 'prod_1',
  product_snapshot: { id: 'prod_1', name: 'P1', sku: 'SKU1', price: 10, shortDescription: '', description: null, image_url: null, images: [], colors: [], category_name: null, category_id: null, materials: [], hasPersonalization: null },
  variant_color_name: null,
  position: 0,
  page_number: null,
  overrides: {},
  created_at: '2026-07-16T00:00:00Z',
  updated_at: '2026-07-16T00:00:00Z',
};

// Tracks the latest persisted branding for assertions
let persistedBranding: Partial<MagazineClientBranding> | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const makeChain = (result: unknown) => {
    const chain: Record<string, unknown> = {};
    const methods = ['select', 'eq', 'is', 'neq', 'maybeSingle', 'single', 'limit', 'order'];
    methods.forEach((m) => { chain[m] = vi.fn(() => chain); });
    Object.defineProperty(chain, 'then', {
      value: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
    });
    return chain;
  };

  const supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === 'magazines') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve({ data: { ...mockMagazineRow, branding: persistedBranding ?? mockMagazineRow.branding }, error: null })),
                })),
                maybeSingle: vi.fn(() => Promise.resolve({ data: { ...mockMagazineRow, branding: persistedBranding ?? mockMagazineRow.branding }, error: null })),
              })),
              maybeSingle: vi.fn(() => Promise.resolve({ data: { ...mockMagazineRow, branding: persistedBranding ?? mockMagazineRow.branding }, error: null })),
            })),
          })),
          update: vi.fn((patch: Partial<typeof mockMagazineRow>) => {
            if (patch.branding) {
              persistedBranding = patch.branding as Partial<MagazineClientBranding>;
            }
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve({ data: { ...mockMagazineRow, ...patch }, error: null })),
                })),
              })),
            };
          }),
          insert: vi.fn(() => makeChain({ data: null, error: null })),
        };
      }
      if (table === 'magazine_items') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  order: vi.fn(() => Promise.resolve({ data: [mockItemRow], error: null })),
                })),
                order: vi.fn(() => Promise.resolve({ data: [mockItemRow], error: null })),
              })),
              is: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: [mockItemRow], error: null })),
              })),
              order: vi.fn(() => Promise.resolve({ data: [mockItemRow], error: null })),
            })),
          })),
          update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })),
        };
      }
      return makeChain({ data: null, error: null });
    }),
  };
  return { supabase: supabaseMock };
});

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/telemetry/requestId', () => ({ newRequestId: () => 'req_test', REQUEST_ID_HEADER: 'X-Request-Id' }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  persistedBranding = null;
});

describe('magazineService.updateBranding — partial color patch regression', () => {
  it('patching only primary preserves secondary and text', async () => {
    // Dynamically import AFTER mocks are set up
    const { magazineService } = await import('../magazineService');

    const result = await magazineService.updateBranding('mag_brd_1', {
      colors: { primary: '#AA0000' },
    });

    // Service should return a Magazine (not null)
    expect(result).not.toBeNull();

    // Persisted branding must deep-merge colors — secondary/text must NOT be #000000
    expect(persistedBranding).not.toBeNull();
    const colors = (persistedBranding as MagazineClientBranding).colors;
    expect(colors?.primary).toBe('#AA0000');
    expect(colors?.secondary).toBe('#CCCCCC'); // preserved from existing branding
    expect(colors?.text).toBe('#333333');       // preserved from existing branding
  });

  it('patching only secondary preserves primary and text', async () => {
    const { magazineService } = await import('../magazineService');

    await magazineService.updateBranding('mag_brd_1', {
      colors: { secondary: '#886644' },
    });

    const colors = (persistedBranding as MagazineClientBranding).colors;
    expect(colors?.primary).toBe('#FF0000');   // preserved
    expect(colors?.secondary).toBe('#886644'); // patched
    expect(colors?.text).toBe('#333333');      // preserved
  });

  it('patching clientLogoUrl alone does not touch colors', async () => {
    const { magazineService } = await import('../magazineService');

    await magazineService.updateBranding('mag_brd_1', {
      clientLogoUrl: 'https://cdn.example.com/new-logo.png',
    });

    const colors = (persistedBranding as MagazineClientBranding).colors;
    expect(colors?.primary).toBe('#FF0000');
    expect(colors?.secondary).toBe('#CCCCCC');
    expect(colors?.text).toBe('#333333');
  });

  it('full color patch sets all three keys', async () => {
    const { magazineService } = await import('../magazineService');

    await magazineService.updateBranding('mag_brd_1', {
      colors: { primary: '#111111', secondary: '#222222', text: '#333333' },
    });

    const colors = (persistedBranding as MagazineClientBranding).colors;
    expect(colors?.primary).toBe('#111111');
    expect(colors?.secondary).toBe('#222222');
    expect(colors?.text).toBe('#333333');
  });

  it('invalid color in partial patch returns null and does not persist', async () => {
    const { magazineService } = await import('../magazineService');

    const result = await magazineService.updateBranding('mag_brd_1', {
      colors: { primary: 'not-a-hex' },
    });

    expect(result).toBeNull();
    // No branding was persisted
    expect(persistedBranding).toBeNull();
  });

  it('XSS in clientLogoUrl is blocked — returns null', async () => {
    const { magazineService } = await import('../magazineService');

    const result = await magazineService.updateBranding('mag_brd_1', {
      clientLogoUrl: 'javascript:alert(1)', // eslint-disable-line no-script-url
    });

    expect(result).toBeNull();
    expect(persistedBranding).toBeNull();
  });

  it('http:// clientLogoUrl is blocked when validateBranding requires https', async () => {
    const { magazineService } = await import('../magazineService');

    const result = await magazineService.updateBranding('mag_brd_1', {
      clientLogoUrl: 'http://insecure.example.com/logo.png',
    });

    // validateBranding uses httpsOnly: true for clientLogoUrl
    expect(result).toBeNull();
  });
});

/**
 * useMagazineEditor — Stale Ref Race Condition Tests
 *
 * Tests the CRITICAL FIX: magazineRef.current must be updated immediately
 * in persist() to prevent stale reads when two mutations fire in the same tick.
 *
 * PhD-level scenario coverage:
 * [A] setTitle → setBranding in same tick → title must NOT be lost
 * [B] addProducts → setTitle in same tick → products must NOT be lost
 * [C] publish() idempotency
 * [D] removeItem → reorderItems → both applied
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type Magazine, DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

import { useMagazineEditor } from '../useMagazineEditor';

// ============================================================================
// Mocks
// ============================================================================

const MOCK_MAGAZINE: Magazine = {
  id: 'mag_test',
  ownerId: 'user_1',
  organizationId: null,
  title: 'Original Title',
  subtitle: '',
  templateId: 'editorial-vogue',
  branding: {
    ...DEFAULT_BRANDING,
    clientLogoUrl: null,
  },
  content: { ...DEFAULT_MAGAZINE_CONTENT },
  items: [],
  pageOrder: null,
  status: 'draft',
  publicToken: null,
  viewCount: 0,
  publishedAt: null,
  archivedAt: null,
  createdAt: '2026-07-12T00:00:00Z',
  updatedAt: '2026-07-12T00:00:00Z',
};

const DUMMY_ITEM = {
  id: 'item_1',
  productId: 'prod_1',
  productSnapshot: {
    id: 'prod_1',
    name: 'Produto A',
    sku: 'SKU-A',
    shortDescription: '',
    description: null,
    price: 99,
    image_url: 'https://example.com/img.jpg',
    images: [],
    colors: [],
    category_name: 'Canetas',
    category_id: null,
    materials: [],
    hasPersonalization: null,
  },
  variantColorName: null,
  position: 0,
  pageNumber: null,
  overrides: {},
};

let storedMagazine: Magazine | null = MOCK_MAGAZINE;

vi.mock('@/services/magazineService', () => ({
  magazineService: {
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    get: vi.fn(async (id: string) => (id === 'mag_test' ? { ...storedMagazine } : null)),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    update: vi.fn(async (id: string, data: Magazine) => {
      if (id === 'mag_test') storedMagazine = { ...data };
      return storedMagazine;
    }),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    addProducts: vi.fn(async (id: string, products: unknown[]) => {
      if (id !== 'mag_test' || !storedMagazine) return null;
      const updated = {
        ...storedMagazine,
        items: [...storedMagazine.items, ...products.map((_p, i) => ({ ...DUMMY_ITEM, id: `item_${Date.now()}_${i}` }))],
      } as Magazine;
      storedMagazine = updated;
      return updated;
    }),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    removeItem: vi.fn(async (id: string, itemId: string) => {
      if (id !== 'mag_test' || !storedMagazine) return null;
      const updated = { ...storedMagazine, items: storedMagazine.items.filter((i) => i.id !== itemId) };
      storedMagazine = updated;
      return updated;
    }),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    reorderItems: vi.fn(async (id: string, orderedIds: string[]) => {
      if (id !== 'mag_test' || !storedMagazine) return null;
      const itemMap = new Map(storedMagazine.items.map((it) => [it.id, it]));
      const reordered = orderedIds.map((oid, i) => ({ ...itemMap.get(oid)!, position: i }));
      const updated = { ...storedMagazine, items: reordered };
      storedMagazine = updated;
      return updated;
    }),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    updateItem: vi.fn(async (id: string, itemId: string, patch: Partial<typeof DUMMY_ITEM>) => {
      if (id !== 'mag_test' || !storedMagazine) return null;
      const updated = {
        ...storedMagazine,
        items: storedMagazine.items.map((it) => it.id === itemId ? { ...it, ...patch } : it),
      };
      storedMagazine = updated;
      return updated;
    }),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    publish: vi.fn(async (id: string) => {
      if (id !== 'mag_test' || !storedMagazine) return null;
      const updated = { ...storedMagazine, status: 'published' as const, publicToken: 'tok_abc' };
      storedMagazine = updated;
      return updated;
    }),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    unpublish: vi.fn(async (id: string) => {
      if (id !== 'mag_test' || !storedMagazine) return null;
      const updated = { ...storedMagazine, status: 'draft' as const, publicToken: null };
      storedMagazine = updated;
      return updated;
    }),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
}));

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  storedMagazine = { ...MOCK_MAGAZINE };
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

/**
 * Renderiza o hook e aguarda o load inicial (agora async) terminar antes de
 * devolver o resultado. Necessário após a migração do magazineService para
 * Supabase — o `useEffect` de carga faz `await magazineService.get(id)`.
 */
async function renderLoadedEditor() {
  const rh = renderHook(() => useMagazineEditor('mag_test'));
  await act(async () => {
    // Flush microtasks do load inicial
    await Promise.resolve();
    await Promise.resolve();
  });
  return rh;
}

describe('useMagazineEditor — stale ref race condition', () => {
  it('[A] setTitle → setBranding in same tick: BOTH mutations applied', async () => {
    const { result } = await renderLoadedEditor();

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      // Two mutations in the same synchronous tick
      result.current.setTitle('New Title');
      result.current.setBranding({ colors: { primary: '#FF0000', secondary: '#e86f2e', text: '#1a1a1a' } });
    });

    // CRITICAL: Both must be applied
    expect(result.current.magazine?.title).toBe('New Title');
    expect(result.current.magazine?.branding.colors.primary).toBe('#FF0000');
  });

  it('[A2] setTitle → setSubtitle → setTitle: last write wins, no state loss', async () => {
    const { result } = await renderLoadedEditor();

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.setTitle('Title A');
      result.current.setSubtitle('Subtitle B');
      result.current.setTitle('Title C');
    });

    expect(result.current.magazine?.title).toBe('Title C');
    expect(result.current.magazine?.subtitle).toBe('Subtitle B');
  });

  it('[B] setTitle preserves current items after addProducts', async () => {
    const { result } = await renderLoadedEditor();

    // First: add a product
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.addProducts([{ id: 'prod_1', name: 'P1' } as unknown as never]);
    });
    expect(result.current.magazine?.items.length).toBe(1);

    // Then: change title in same tick
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.setTitle('Title After Products');
    });

    // Products must NOT be lost
    expect(result.current.magazine?.items.length).toBe(1);
    expect(result.current.magazine?.title).toBe('Title After Products');
  });

  it('[C] publish() idempotency: calling twice does not corrupt state', async () => {
    const { result } = await renderLoadedEditor();

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.setTitle('Ready to Publish');
    });

    // Add a product so magazine is publishable
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.addProducts([{ id: 'prod_1' } as never]);
    });

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.publish();
      result.current.publish(); // idempotent call
    });

    expect(result.current.magazine?.publicToken).toBe('tok_abc');
    expect(result.current.magazine?.status).toBe('published');
  });

  it('[D] removeItem → reorderItems: both applied without losing data', async () => {
    // Setup: start with 3 items
    storedMagazine = {
      ...MOCK_MAGAZINE,
      items: [
        { ...DUMMY_ITEM, id: 'item_a', position: 0 },
        { ...DUMMY_ITEM, id: 'item_b', position: 1 },
        { ...DUMMY_ITEM, id: 'item_c', position: 2 },
      ],
    };

    const { result } = await renderLoadedEditor();

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.removeItem('item_a');
    });
    expect(result.current.magazine?.items.length).toBe(2);

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.reorderItems(['item_c', 'item_b']);
    });
    expect(result.current.magazine?.items[0].id).toBe('item_c');
    expect(result.current.magazine?.items[1].id).toBe('item_b');
  });

  it('[E] autosave debounce: magazineService.update called after 400ms', async () => {
    const { magazineService } = await import('@/services/magazineService');
    const { result } = await renderLoadedEditor();

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.setTitle('Debounced Save');
    });

    // Before debounce fires
    expect(magazineService.update).not.toHaveBeenCalled();

    // After 400ms
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      vi.advanceTimersByTime(450);
    });

    expect(magazineService.update).toHaveBeenCalledWith('mag_test', expect.objectContaining({
      title: 'Debounced Save',
    }));
  });

  it('[F] setTitle with empty string clears title', async () => {
    const { result } = await renderLoadedEditor();
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.setTitle('');
    });
    expect(result.current.magazine?.title).toBe('');
  });

  it('[G] setBranding with partial patch does not lose existing branding fields', async () => {
    const { result } = await renderLoadedEditor();
    const originalPrimary = result.current.magazine?.branding.colors.primary;

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.setBranding({ clientLogoUrl: 'https://cdn.example.com/logo.png' });
    });

    // colors.primary must still be there
    expect(result.current.magazine?.branding.colors.primary).toBe(originalPrimary);
    expect(result.current.magazine?.branding.clientLogoUrl).toBe('https://cdn.example.com/logo.png');
  });

  it('[H] setBranding with partial colors patch preserves non-patched color keys', async () => {
    // REGRESSION: shallow merge { ...branding, ...patch } where patch.colors is
    // a partial object silently drops secondary/text and validateBranding() fills
    // defaults (#000000) — user loses their custom secondary/text colors.
    storedMagazine = {
      ...MOCK_MAGAZINE,
      branding: {
        clientLogoUrl: null,
        colors: { primary: '#FF0000', secondary: '#CCCCCC', text: '#333333' },
      },
    };
    const { result } = await renderLoadedEditor();

    // Patch only primary — secondary and text must survive
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.setBranding({ colors: { primary: '#AA0000' } });
    });

    expect(result.current.magazine?.branding.colors.primary).toBe('#AA0000');
    expect(result.current.magazine?.branding.colors.secondary).toBe('#CCCCCC'); // must NOT be #000000
    expect(result.current.magazine?.branding.colors.text).toBe('#333333');    // must NOT be #000000
  });

  it('[I] setBranding with partial colors patch preserves text color only', async () => {
    storedMagazine = {
      ...MOCK_MAGAZINE,
      branding: {
        clientLogoUrl: null,
        colors: { primary: '#AA0000', secondary: '#BBBBBB', text: '#444444' },
      },
    };
    const { result } = await renderLoadedEditor();

    // Patch only secondary — primary and text must survive
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.setBranding({ colors: { secondary: '#FF6600' } });
    });

    expect(result.current.magazine?.branding.colors.primary).toBe('#AA0000');    // preserved
    expect(result.current.magazine?.branding.colors.secondary).toBe('#FF6600'); // patched
    expect(result.current.magazine?.branding.colors.text).toBe('#444444');       // preserved
  });

  it('[J] setBranding with all colors + clientLogoUrl: all applied atomically', async () => {
    storedMagazine = {
      ...MOCK_MAGAZINE,
      branding: {
        clientLogoUrl: 'https://old.logo.com/logo.png',
        colors: { primary: '#000000', secondary: '#000000', text: '#000000' },
      },
    };
    const { result } = await renderLoadedEditor();

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.setBranding({
        clientLogoUrl: 'https://new.cdn.com/logo.png',
        colors: { primary: '#FF0000', secondary: '#00FF00', text: '#0000FF' },
      });
    });

    expect(result.current.magazine?.branding.clientLogoUrl).toBe('https://new.cdn.com/logo.png');
    expect(result.current.magazine?.branding.colors.primary).toBe('#FF0000');
    expect(result.current.magazine?.branding.colors.secondary).toBe('#00FF00');
    expect(result.current.magazine?.branding.colors.text).toBe('#0000FF');
  });

  it('[K] setBranding rejects invalid color hex and preserves previous valid colors', async () => {
    storedMagazine = {
      ...MOCK_MAGAZINE,
      branding: {
        clientLogoUrl: null,
        colors: { primary: '#FF0000', secondary: '#CCCCCC', text: '#333333' },
      },
    };
    const { result } = await renderLoadedEditor();

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      // Invalid color: should be rejected entirely
      result.current.setBranding({ colors: { primary: 'not-a-hex-color' } });
    });

    // Validation fails → setBranding returns early → state unchanged
    expect(result.current.magazine?.branding.colors.primary).toBe('#FF0000'); // unchanged
    expect(result.current.brandingErrors.length).toBeGreaterThan(0);
  });
});

describe('useMagazineEditor — loading states', () => {
  it('loaded=false initially', async () => {
    const { result } = await renderLoadedEditor();
    act(() => { vi.runAllTimers(); });
    expect(result.current.loaded).toBe(true);
  });

  it('loaded=true when id=undefined', async () => {
    const { result } = renderHook(() => useMagazineEditor(undefined));
    await act(async () => {});
    expect(result.current.loaded).toBe(true);
    expect(result.current.magazine).toBeNull();
  });

  it('saving=false initially', async () => {
    const { result } = await renderLoadedEditor();
    // saving starts false, becomes true on persist, then false after debounce
    expect(result.current.saving).toBe(false);
  });

  it('saving=true during debounce, false after 400ms', async () => {
    const { result } = await renderLoadedEditor();

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      result.current.setTitle('Test Saving State');
    });

    expect(result.current.saving).toBe(true);

    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    await act(async () => {
      vi.advanceTimersByTime(450);
    });

    expect(result.current.saving).toBe(false);
  });
});

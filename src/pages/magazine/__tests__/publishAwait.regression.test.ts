/**
 * Regression: MagazineEditor.publish() precisa ser await'ed e o estado final
 * deve refletir o resultado do update (status=published, publicToken populado).
 *
 * Bug histórico: o handler `publish` do editor chamava `editor.publish()` sem
 * `await`, então o `updated?.publicToken` era `undefined` e o toast/clipboard
 * silenciava. Este teste trava o contrato assíncrono.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type Magazine, DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

import { useMagazineEditor } from '../useMagazineEditor';

const BASE: Magazine = {
  id: 'mag_pub',
  ownerId: 'user_1',
  organizationId: null,
  title: 'Revista Pronta',
  subtitle: '',
  templateId: 'editorial-vogue',
  branding: { ...DEFAULT_BRANDING, clientLogoUrl: null },
  content: { ...DEFAULT_MAGAZINE_CONTENT },
  items: [
    {
      id: 'it1',
      productId: 'p1',
      productSnapshot: {
        id: 'p1',
        name: 'A',
        sku: 'A',
        shortDescription: '',
        description: null,
        price: 10,
        image_url: '',
        images: [],
        colors: [],
        category_name: '',
        category_id: null,
        materials: [],
        hasPersonalization: null,
      },
      variantColorName: null,
      position: 0,
      pageNumber: null,
      overrides: {},
    },
  ],
  pageOrder: null,
  status: 'draft',
  publicToken: null,
  publishedAt: null,
  createdAt: '2026-07-12T00:00:00Z',
  updatedAt: '2026-07-12T00:00:00Z',
};

let store: Magazine = { ...BASE };
let publishResolveDelayMs = 0;

vi.mock('@/services/magazineService', () => ({
  magazineService: {
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    get: vi.fn(async () => ({ ...store })),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    update: vi.fn(async (_id: string, data: Magazine) => {
      store = { ...data };
      return store;
    }),
    publish: vi.fn(async () => {
      if (publishResolveDelayMs > 0) {
        await new Promise((r) => setTimeout(r, publishResolveDelayMs));
      }
      const updated: Magazine = {
        ...store,
        status: 'published',
        publicToken: 'tok_xyz',
        publishedAt: '2026-07-12T12:00:00Z',
      };
      store = updated;
      return updated;
    }),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    unpublish: vi.fn(async () => store),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    addProducts: vi.fn(async () => store),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    removeItem: vi.fn(async () => store),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    reorderItems: vi.fn(async () => store),
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    updateItem: vi.fn(async () => store),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
}));

async function renderLoaded() {
  const rh = renderHook(() => useMagazineEditor('mag_pub'));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return rh;
}

beforeEach(() => {
  store = { ...BASE };
  publishResolveDelayMs = 0;
});
afterEach(() => vi.clearAllMocks());

describe('publish() — contrato async e estado final', () => {
  it('resolve com Magazine atualizada (status=published, publicToken != null)', async () => {
    const { result } = await renderLoaded();

    let returned: Magazine | null = null;
    await act(async () => {
      returned = await result.current.publish();
    });

    expect(returned).not.toBeNull();
    expect(returned!.status).toBe('published');
    expect(returned!.publicToken).toBe('tok_xyz');
  });

  it('estado do hook reflete o resultado após await', async () => {
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.magazine?.status).toBe('published');
    expect(result.current.magazine?.publicToken).toBe('tok_xyz');
    expect(result.current.magazine?.publishedAt).toBe('2026-07-12T12:00:00Z');
  });

  it('sem await, estado ainda está pendente ANTES da microtask flush (regressão)', async () => {
    const { result } = await renderLoaded();

    // Fire-and-forget: sem await intencional
    let promise: Promise<Magazine | null> | undefined;
    act(() => {
      promise = result.current.publish();
    });

    // Antes de flush, estado permanece draft — prova que o resultado só chega via await
    expect(result.current.magazine?.status).toBe('draft');
    expect(result.current.magazine?.publicToken).toBeNull();

    // Ao aguardar, estado atualiza
    await act(async () => {
      await promise;
    });
    expect(result.current.magazine?.status).toBe('published');
    expect(result.current.magazine?.publicToken).toBe('tok_xyz');
  });

  it('respeita latência do service (delay 50ms) e ainda entrega estado final', async () => {
    publishResolveDelayMs = 50;
    const { result } = await renderLoaded();

    const p = act(async () => {
      await result.current.publish();
    });
    await p;

    expect(result.current.magazine?.publicToken).toBe('tok_xyz');
  });

  it('idempotência: chamar publish() duas vezes seguidas não corrompe estado', async () => {
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.publish();
      await result.current.publish();
    });

    expect(result.current.magazine?.status).toBe('published');
    expect(result.current.magazine?.publicToken).toBe('tok_xyz');
  });
});

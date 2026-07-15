/**
 * Testes unitários do hook `useMagazinePublish`.
 * Cobrem os 8 contratos (U1..U8) documentados no cabeçalho do hook.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useMagazinePublish } from '../useMagazinePublish';
import type { Magazine } from '@/types/magazine';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

const baseMagazine: Magazine = {
  id: 'mag-1',
  ownerId: 'u1',
  organizationId: null,
  title: 'Test',
  subtitle: '',
  templateId: 'classic' as Magazine['templateId'],
  branding: {} as Magazine['branding'],
  content: {} as Magazine['content'],
  items: [],
  pageOrder: null,
  status: 'published',
  publicToken: 'abcdef0123456789abcdef0123456789',
  pdfUrl: null,
  publishedAt: '2026-07-15T00:00:00Z',
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-15T00:00:00Z',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useMagazinePublish', () => {
  it('U1 — publishable=false → toast.error e não chama publishFn', async () => {
    const publishFn = vi.fn();
    const { result } = renderHook(() =>
      useMagazinePublish({ publishable: false, publishFn, origin: 'http://x' }),
    );
    await act(async () => {
      await result.current.publish();
    });
    expect(publishFn).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'Não é possível publicar ainda.',
      expect.objectContaining({ description: expect.stringContaining('título') }),
    );
  });

  it('U3 — publishFn lança → toast.error com error.message', async () => {
    const publishFn = vi.fn().mockRejectedValue(new Error('RLS denied'));
    const { result } = renderHook(() =>
      useMagazinePublish({ publishable: true, publishFn, origin: 'http://x' }),
    );
    await act(async () => {
      await result.current.publish();
    });
    expect(toast.error).toHaveBeenCalledWith(
      'Falha ao publicar a revista.',
      expect.objectContaining({ description: expect.stringContaining('RLS denied') }),
    );
    expect(result.current.publishing).toBe(false);
  });

  it('U4 — publishFn resolve null → toast.error (RLS silent-fail)', async () => {
    const publishFn = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      useMagazinePublish({ publishable: true, publishFn, origin: 'http://x' }),
    );
    await act(async () => {
      await result.current.publish();
    });
    expect(toast.error).toHaveBeenCalledWith(
      'Falha ao publicar a revista.',
      expect.objectContaining({ description: expect.stringContaining('RLS') }),
    );
  });

  it('U5 — publishFn resolve sem publicToken → toast.warning', async () => {
    const publishFn = vi.fn().mockResolvedValue({ ...baseMagazine, publicToken: null });
    const { result } = renderHook(() =>
      useMagazinePublish({ publishable: true, publishFn, origin: 'http://x' }),
    );
    await act(async () => {
      await result.current.publish();
    });
    expect(toast.warning).toHaveBeenCalledWith(
      'Revista publicada, mas sem link público.',
      expect.any(Object),
    );
  });

  it('U6 — token + clipboard OK → toast.success + link', async () => {
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    const publishFn = vi.fn().mockResolvedValue(baseMagazine);
    const { result } = renderHook(() =>
      useMagazinePublish({
        publishable: true,
        publishFn,
        origin: 'http://x',
        writeClipboard,
      }),
    );
    await act(async () => {
      await result.current.publish();
    });
    expect(writeClipboard).toHaveBeenCalledWith(
      'http://x/revista-publica/abcdef0123456789abcdef0123456789',
    );
    expect(toast.success).toHaveBeenCalledWith(
      'Revista publicada com sucesso.',
      expect.objectContaining({ description: expect.stringContaining('Link copiado') }),
    );
    expect(result.current.lastPublicUrl).toBe(
      'http://x/revista-publica/abcdef0123456789abcdef0123456789',
    );
  });

  it('U7 — token + clipboard falha → toast.success com fallback', async () => {
    const writeClipboard = vi.fn().mockRejectedValue(new Error('denied'));
    const publishFn = vi.fn().mockResolvedValue(baseMagazine);
    const { result } = renderHook(() =>
      useMagazinePublish({
        publishable: true,
        publishFn,
        origin: 'http://x',
        writeClipboard,
      }),
    );
    await act(async () => {
      await result.current.publish();
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Revista publicada com sucesso.',
      expect.objectContaining({
        description: expect.stringContaining('Não foi possível copiar'),
      }),
    );
    expect(result.current.lastPublicUrl).toContain('/revista-publica/');
  });

  it('U8 — publishing volta a false mesmo com exceção', async () => {
    const publishFn = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useMagazinePublish({ publishable: true, publishFn, origin: 'http://x' }),
    );
    await act(async () => {
      await result.current.publish();
    });
    await waitFor(() => expect(result.current.publishing).toBe(false));
  });

  it('U2 — chamadas concorrentes: segunda vira no-op enquanto a primeira está em voo', async () => {
    let resolvePublish: (v: Magazine) => void = () => {};
    const publishFn = vi.fn(
      () =>
        new Promise<Magazine>((resolve) => {
          resolvePublish = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useMagazinePublish({ publishable: true, publishFn, origin: 'http://x' }),
    );

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.publish();
    });
    // segunda chamada em pleno vôo — não deve disparar novo publishFn
    await act(async () => {
      await result.current.publish();
    });
    expect(publishFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePublish(baseMagazine);
      await first;
    });
    expect(result.current.publishing).toBe(false);
  });
});

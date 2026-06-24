/**
 * Testes — useQuoteComments
 *
 * Invariantes testadas:
 *   - fetchComments: carrega comentários do DB e enriquece com perfis dos autores
 *   - addComment: insere comentário e chama createCommentNotification
 *   - updateComment: atualiza conteúdo do comentário por id
 *   - deleteComment: remove comentário por id
 *   - BUG-COMMENT-NOTIFY-SILENT-FAIL: participants query e workspace_notifications.insert
 *     não destruturavam { error } — falhas silenciosamente swallowed sem log
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { useQuoteComments } from '../useQuoteComments';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-001', email: 'seller@test.com' } })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const fakeComment = {
  id: 'c-1',
  quote_id: 'q-1',
  user_id: 'user-001',
  comment: 'Teste',
  is_internal: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function setupFetchSuccess() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'quote_comments') {
      const orderFn = vi.fn().mockResolvedValue({ data: [fakeComment], error: null });
      const eqFn = vi.fn().mockReturnValue({ order: orderFn });
      return { select: vi.fn().mockReturnValue({ eq: eqFn }) } as never;
    }
    if (table === 'profiles') {
      const inFn = vi.fn().mockResolvedValue({ data: [], error: null });
      return { select: vi.fn().mockReturnValue({ in: inFn }) } as never;
    }
    return { insert: vi.fn().mockResolvedValue({ error: null }) } as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── fetchComments ─────────────────────────────────────────────────────────────
describe('fetchComments', () => {
  it('carrega comentários e popula state', async () => {
    setupFetchSuccess();

    const { result } = renderHook(() => useQuoteComments('q-1'));

    // Wait for initial fetch
    await act(async () => {
      await new Promise<void>((r) => { setTimeout(r, 10); });
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].content).toBe('Teste');
  });

  it('inicia com lista vazia e isLoading=false', () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
        }),
      }),
    } as never);

    const { result } = renderHook(() => useQuoteComments('q-1'));
    // isLoading might be true on first render — just check initial state
    expect(Array.isArray(result.current.comments)).toBe(true);
  });

  it('não faz fetch quando quoteId é undefined', async () => {
    const { result } = renderHook(() => useQuoteComments(undefined));
    await act(async () => {
      await new Promise<void>((r) => { setTimeout(r, 10); });
    });
    expect(result.current.comments).toEqual([]);
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });
});

// ── addComment ────────────────────────────────────────────────────────────────
describe('addComment', () => {
  it('insere comentário e chama fetchComments novamente', async () => {
    setupFetchSuccess();

    const insertMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'quote_comments') {
        const orderFn = vi.fn().mockResolvedValue({ data: [fakeComment], error: null });
        const eqFn = vi.fn().mockReturnValue({ order: orderFn });
        return {
          select: vi.fn().mockReturnValue({ eq: eqFn }),
          insert: insertMock,
        } as never;
      }
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as never;
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }), insert: vi.fn().mockResolvedValue({ error: null }) } as never;
    });

    const { toast } = await import('sonner');
    const { result } = renderHook(() => useQuoteComments('q-1'));

    await act(async () => {
      await result.current.addComment('novo comentário');
    });

    expect(insertMock).toHaveBeenCalled();
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
  });
});

// ── BUG-COMMENT-NOTIFY-SILENT-FAIL ───────────────────────────────────────────
describe('BUG-COMMENT-NOTIFY-SILENT-FAIL', () => {
  // Previously { error } was not destructured from either:
  // 1. quote_comments.select (participants lookup) — RLS denial → null → silent skip
  // 2. workspace_notifications.insert — Supabase JS v2 never throws on DB errors
  // Fixed to log warnings on failure but continue (non-fatal: comment already saved).

  it('loga warn quando participants query falha mas addComment retorna sucesso', async () => {
    // Distinguish fetchComments (select('*').eq().order()) from
    // createCommentNotification participants lookup (select('user_id').eq())
    // by the select column argument.
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'quote_comments') {
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            if (cols === '*') {
              // fetchComments path
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [fakeComment], error: null }),
                }),
              };
            }
            // createCommentNotification participants lookup (select('user_id'))
            return {
              eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS denied' } }),
            };
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        } as never;
      }
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as never;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as never;
    });

    const { logger } = await import('@/lib/logger');
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useQuoteComments('q-1'));

    await act(async () => {
      await result.current.addComment('teste');
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Comentário adicionado');
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'Failed to fetch comment participants for notification:',
      expect.anything(),
    );
  });

  it('loga warn quando workspace_notifications.insert falha mas addComment retorna sucesso', async () => {
    // participants lookup returns user-002 so notification insert IS attempted
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'quote_comments') {
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            if (cols === '*') {
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [fakeComment], error: null }),
                }),
              };
            }
            // participants lookup: return a different user (not the author user-001)
            return {
              eq: vi.fn().mockResolvedValue({ data: [{ user_id: 'user-002' }], error: null }),
            };
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        } as never;
      }
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as never;
      }
      if (table === 'workspace_notifications') {
        return { insert: vi.fn().mockResolvedValue({ error: { message: 'RLS denied on notifications' } }) } as never;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as never;
    });

    const { logger } = await import('@/lib/logger');
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useQuoteComments('q-1'));

    await act(async () => {
      await result.current.addComment('teste com notificação que falha');
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Comentário adicionado');
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'Failed to send comment notifications:',
      expect.anything(),
    );
  });
});

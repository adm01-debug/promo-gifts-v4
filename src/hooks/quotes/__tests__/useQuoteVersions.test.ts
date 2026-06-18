/**
 * Testes — useQuoteVersions
 *
 * Gerencia o histórico de versões de orçamentos.
 * Cada orçamento pode ter N versões: root + children com parent_quote_id.
 *
 * Invariantes testadas:
 *   - Estado inicial: versions=[], isLoading=false
 *   - Expõe as 3 funções esperadas
 *   - fetchVersions: no-op quando quoteId undefined
 *   - fetchVersions: busca quote pelo id, encontra root, lista versões
 *   - fetchVersions: lida com erro (não propaga, loga)
 *   - createNewVersion: retorna null quando user=null
 *   - createNewVersion: retorna null quando quote não encontrado
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuoteVersions } from '../useQuoteVersions';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockOr = vi.fn();
const mockIn = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();

const mockFromChain = {
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
  or: mockOr,
  order: mockOrder,
  in: mockIn,
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => mockFromChain) },
}));

const mockUser = { id: 'user-001', email: 'seller@test.com' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

const mockFetchQuote = vi.fn();
const mockCreateQuote = vi.fn();
const mockLogQuoteHistory = vi.fn();
vi.mock('@/hooks/quotes/useQuotes', () => ({
  useQuotes: vi.fn(() => ({
    fetchQuote: mockFetchQuote,
    createQuote: mockCreateQuote,
    logQuoteHistory: mockLogQuoteHistory,
  })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

// ── Estado inicial ────────────────────────────────────────────────────────────
describe('estado inicial', () => {
  it('versions=[], isLoading=false', () => {
    const { result } = renderHook(() => useQuoteVersions());
    expect(result.current.versions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('expõe fetchVersions, createNewVersion', () => {
    const { result } = renderHook(() => useQuoteVersions());
    expect(typeof result.current.fetchVersions).toBe('function');
    expect(typeof result.current.createNewVersion).toBe('function');
  });
});

// ── fetchVersions ─────────────────────────────────────────────────────────────
describe('fetchVersions', () => {
  it('no-op quando quoteId undefined e nenhum argumento', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const { result } = renderHook(() => useQuoteVersions()); // sem quoteId

    await act(async () => {
      await result.current.fetchVersions(); // sem argumento
    });

    expect(supabase.from).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('busca versões quando quoteId passado por argumento', async () => {
    // Mock: quote sem parent (root)
    const quoteData = { id: 'q-root', parent_quote_id: null, version: 1 };
    const versionsData = [
      { id: 'q-root', quote_number: 'ORC-001', version: 1, status: 'draft',
        total: 100, subtotal: 100, discount_amount: 0, discount_percent: 0,
        created_at: '2026-01-01', updated_at: '2026-01-01',
        is_latest_version: false, parent_quote_id: null },
    ];

    // Chain: .from('quotes').select().eq().single()
    const singleMock = vi.fn().mockResolvedValue({ data: quoteData, error: null });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    // Chain: .from('quotes').select().or().order()
    const orderMock = vi.fn().mockResolvedValue({ data: versionsData, error: null });
    const orMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock2 = vi.fn().mockReturnValue({ or: orMock });
    // Chain: .from('quote_items').select().in()
    const inMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectMock3 = vi.fn().mockReturnValue({ in: inMock });

    const { supabase } = await import('@/integrations/supabase/client');
    let call = 0;
    vi.mocked(supabase.from).mockImplementation(() => {
      call++;
      if (call === 1) return { select: selectMock } as never; // first: get quote
      if (call === 2) return { select: selectMock2 } as never; // second: get versions
      return { select: selectMock3 } as never; // third: item counts
    });

    const { result } = renderHook(() => useQuoteVersions());
    await act(async () => {
      await result.current.fetchVersions('q-root');
    });

    expect(result.current.versions).toHaveLength(1);
    expect(result.current.versions[0].id).toBe('q-root');
    expect(result.current.isLoading).toBe(false);
  });

  it('trata erro sem propagar (loga e mantém isLoading=false)', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as never);

    const { logger } = await import('@/lib/logger');
    const { result } = renderHook(() => useQuoteVersions());

    await act(async () => {
      await result.current.fetchVersions('q-nao-existe');
    });

    expect(vi.mocked(logger.error)).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.versions).toEqual([]);
  });
});

// ── createNewVersion ──────────────────────────────────────────────────────────
describe('createNewVersion', () => {
  it('retorna null quando user = null', async () => {
    const { useAuth } = await import('@/contexts/AuthContext');
    vi.mocked(useAuth).mockReturnValueOnce({ user: null } as never);

    const { toast } = await import('sonner');
    const { result } = renderHook(() => useQuoteVersions());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createNewVersion('q-src');
    });

    expect(outcome).toBeNull();
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
  });

  it('retorna null quando quote fonte nao encontrado', async () => {
    mockFetchQuote.mockResolvedValue(null); // quote não encontrado

    const { logger } = await import('@/lib/logger');
    const { result } = renderHook(() => useQuoteVersions());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createNewVersion('q-inexistente');
    });

    expect(outcome).toBeNull();
    expect(vi.mocked(logger.error)).toHaveBeenCalled();
  });
});

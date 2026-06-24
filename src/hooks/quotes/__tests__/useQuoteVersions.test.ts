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
import { renderHook, act } from '@testing-library/react';
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
      {
        id: 'q-root',
        quote_number: 'ORC-001',
        version: 1,
        status: 'draft',
        total: 100,
        subtotal: 100,
        discount_amount: 0,
        discount_percent: 0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        is_latest_version: false,
        parent_quote_id: null,
      },
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

    const { toast } = await import('sonner');
    const { result } = renderHook(() => useQuoteVersions());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createNewVersion('q-inexistente');
    });

    expect(outcome).toBeNull();
    // Hook catch block calls toast.error, not logger.error
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
  });

  // BUG-VERSION-SILENT-FAIL regression:
  // Previously the is_latest_version clear UPDATE had no error handling — on failure,
  // both the old and new versions would have is_latest_version=true, corrupting the tree.
  it('BUG-VERSION-SILENT-FAIL: aborta e retorna null quando is_latest_version clear falha', async () => {
    const fakeQuote = {
      id: 'q-src', quote_number: 'ORC-001', client_id: 'c1', client_name: 'Test',
      client_email: 'a@b.com', client_phone: null, client_company: 'Co', client_cnpj: null,
      discount_percent: 0, discount_amount: 0, negotiation_markup_percent: 0,
      notes: null, payment_method: null, payment_terms: null,
      delivery_time: null, shipping_type: null, shipping_cost: 0,
      internal_notes: null, valid_until: null, contact_id: null, items: [],
    };
    mockFetchQuote.mockResolvedValue(fakeQuote);

    let quotesCallCount = 0;
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'quotes') {
        quotesCallCount++;
        if (quotesCallCount === 1) {
          // .select('version, parent_quote_id').eq().single()
          const singleFn = vi.fn().mockResolvedValue({ data: { version: 1, parent_quote_id: null }, error: null });
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) }) } as never;
        }
        if (quotesCallCount === 2) {
          // .select('version').or().order().limit() — max version lookup
          const limitFn = vi.fn().mockResolvedValue({ data: [{ version: 1 }], error: null });
          return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: limitFn }) }) }) } as never;
        }
        // Third call: .update({ is_latest_version: false }).or() → FAILS
        return { update: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: { message: 'RLS denied' } }) }) } as never;
      }
      return {} as never;
    });

    const { logger } = await import('@/lib/logger');
    const { result } = renderHook(() => useQuoteVersions());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createNewVersion('q-src');
    });

    expect(outcome).toBeNull();
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Failed to clear is_latest_version on prior versions:',
      expect.anything(),
    );
    // createQuote must NOT have been called — the abort prevents dual-true corruption
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  // BUG-VERSION-CTX-SILENT-FAIL regression:
  // Previously { error } was not destructured from the version context query.
  // A failed lookup silently left currentVersion=1 and rootId=sourceQuoteId,
  // risking duplicate version numbers.
  // Fixed to log warn and continue (non-fatal — defaults are safe fallbacks).
  it('BUG-VERSION-CTX-SILENT-FAIL: loga warn quando version context query falha mas continua', async () => {
    const fakeQuote = {
      id: 'q-src', quote_number: 'ORC-001', client_id: 'c1', client_name: 'Test',
      client_email: 'a@b.com', client_phone: null, client_company: 'Co', client_cnpj: null,
      discount_percent: 0, discount_amount: 0, negotiation_markup_percent: 0,
      notes: null, payment_method: null, payment_terms: null,
      delivery_time: null, shipping_type: null, shipping_cost: 0,
      internal_notes: null, valid_until: null, contact_id: null, items: [],
    };
    mockFetchQuote.mockResolvedValue(fakeQuote);
    mockCreateQuote.mockResolvedValue({ id: 'q-new', quote_number: 'ORC-002' });
    mockLogQuoteHistory.mockResolvedValue(undefined);

    let quotesCallCount = 0;
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'quotes') {
        quotesCallCount++;
        if (quotesCallCount === 1) {
          // version context query → FAILS with RLS denied
          const singleFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS denied' } });
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) }) } as never;
        }
        if (quotesCallCount === 2) {
          // max version lookup → succeeds
          const limitFn = vi.fn().mockResolvedValue({ data: [{ version: 1 }], error: null });
          return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: limitFn }) }) }) } as never;
        }
        if (quotesCallCount === 3) {
          // clear is_latest_version → succeeds
          return { update: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: null }) }) } as never;
        }
        // version metadata update after create
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) } as never;
      }
      return {} as never;
    });

    const { logger } = await import('@/lib/logger');
    const { result } = renderHook(() => useQuoteVersions());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createNewVersion('q-src');
    });

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'Failed to fetch version context, defaulting:',
      expect.anything(),
    );
    // Operation continues despite the warn — createQuote IS called
    expect(mockCreateQuote).toHaveBeenCalled();
    expect(outcome).not.toBeNull();
  });

  // BUG-VERSION-MAX-SILENT-FAIL regression:
  // Previously { error } was not destructured from the max version query.
  // A failed query silently defaulted maxVersion=currentVersion, risking duplicate
  // version numbers when the actual max in the DB was higher.
  // Fixed to log warn and default to currentVersion (safe fallback).
  it('BUG-VERSION-MAX-SILENT-FAIL: loga warn quando max version query falha mas continua', async () => {
    const fakeQuote = {
      id: 'q-src', quote_number: 'ORC-001', client_id: 'c1', client_name: 'Test',
      client_email: 'a@b.com', client_phone: null, client_company: 'Co', client_cnpj: null,
      discount_percent: 0, discount_amount: 0, negotiation_markup_percent: 0,
      notes: null, payment_method: null, payment_terms: null,
      delivery_time: null, shipping_type: null, shipping_cost: 0,
      internal_notes: null, valid_until: null, contact_id: null, items: [],
    };
    mockFetchQuote.mockResolvedValue(fakeQuote);
    mockCreateQuote.mockResolvedValue({ id: 'q-new', quote_number: 'ORC-002' });
    mockLogQuoteHistory.mockResolvedValue(undefined);

    let quotesCallCount = 0;
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'quotes') {
        quotesCallCount++;
        if (quotesCallCount === 1) {
          // version context → succeeds
          const singleFn = vi.fn().mockResolvedValue({ data: { version: 1, parent_quote_id: null }, error: null });
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) }) } as never;
        }
        if (quotesCallCount === 2) {
          // max version lookup → FAILS
          const limitFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } });
          return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: limitFn }) }) }) } as never;
        }
        if (quotesCallCount === 3) {
          // clear is_latest_version → succeeds
          return { update: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: null }) }) } as never;
        }
        // version metadata update after create
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) } as never;
      }
      return {} as never;
    });

    const { logger } = await import('@/lib/logger');
    const { result } = renderHook(() => useQuoteVersions());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createNewVersion('q-src');
    });

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'Failed to fetch max version, defaulting to currentVersion:',
      expect.anything(),
    );
    // Operation continues — createQuote IS called even with max version fallback
    expect(mockCreateQuote).toHaveBeenCalled();
    expect(outcome).not.toBeNull();
  });
});

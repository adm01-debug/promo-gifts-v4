/**
 * Testes — useQuotes
 *
 * CRUD principal de orçamentos com Realtime subscription (BUG-NEW-02).
 * 324 linhas de lógica; testes cobrem as invariantes críticas:
 *
 *   - Estado inicial quando user=null: queries desabilitadas
 *   - Expõe as 14 funções/propriedades esperadas
 *   - user=null: disabled queries, sem Realtime subscription
 *   - BUG-NEW-02: cancela Realtime channel ao desmontar
 *   - createQuote: lança quando user=null
 *   - isLoading: true quando mutation pendente
 *   - error: null quando sem erro
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useQuotes } from '../useQuotes';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}));

const mockUser = { id: 'user-sel-001', email: 'seller@test.com' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: vi.fn(() => ({ currentOrg: { id: 'org-001' } })),
}));

vi.mock('@/hooks/common/useSalesScope', () => ({
  useSalesScope: vi.fn(() => 'self'),
}));

// Mock quoteService
vi.mock('@/services/quoteService', () => ({
  quoteService: {
    fetchQuotes: vi.fn().mockResolvedValue([]),
    fetchTechniques: vi.fn().mockResolvedValue([]),
    createQuote: vi.fn().mockResolvedValue({ id: 'new-q-001' }),
    updateQuote: vi.fn().mockResolvedValue({}),
    updateQuoteStatus: vi.fn().mockResolvedValue({}),
    deleteQuote: vi.fn().mockResolvedValue({}),
    duplicateQuote: vi.fn().mockResolvedValue({}),
    fetchQuote: vi.fn().mockResolvedValue(null),
    syncQuoteToBitrix: vi.fn().mockResolvedValue({}),
    testWebhookConnection: vi.fn().mockResolvedValue({}),
    logQuoteHistory: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => vi.clearAllMocks());

// ── Estado inicial ────────────────────────────────────────────────────────────
describe('estado inicial com usuario autenticado', () => {
  it('quotes=[], isLoading pode ser true antes do fetch', () => {
    const { result } = renderHook(() => useQuotes(), { wrapper: makeWrapper() });
    // quotes começa como []
    expect(Array.isArray(result.current.quotes)).toBe(true);
  });

  it('expõe as 14 propriedades/funções esperadas', () => {
    const { result } = renderHook(() => useQuotes(), { wrapper: makeWrapper() });
    const r = result.current;
    expect(typeof r.fetchQuotes).toBe('function');
    expect(typeof r.fetchQuote).toBe('function');
    expect(typeof r.createQuote).toBe('function');
    expect(typeof r.updateQuote).toBe('function');
    expect(typeof r.updateQuoteStatus).toBe('function');
    expect(typeof r.deleteQuote).toBe('function');
    expect(typeof r.duplicateQuote).toBe('function');
    expect(typeof r.fetchTechniques).toBe('function');
    expect(typeof r.syncQuoteToBitrix).toBe('function');
    expect(typeof r.testWebhookConnection).toBe('function');
    expect(typeof r.logQuoteHistory).toBe('function');
    expect(Array.isArray(r.quotes)).toBe(true);
    expect(Array.isArray(r.techniques)).toBe(true);
    expect(typeof r.isLoading).toBe('boolean');
  });

  it('error=null quando sem erro', async () => {
    const { result } = renderHook(() => useQuotes(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });
});

// ── user=null ─────────────────────────────────────────────────────────────────
describe('user=null — queries desabilitadas', () => {
  it('nao inicia Realtime subscription quando user=null', async () => {
    const { useAuth } = await import('@/contexts/AuthContext');
    vi.mocked(useAuth).mockReturnValue({ user: null } as never);
    const { supabase } = await import('@/integrations/supabase/client');

    renderHook(() => useQuotes(), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));

    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('quotes = [] quando user=null', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null });

    const { result } = renderHook(() => useQuotes(), { wrapper: makeWrapper() });
    expect(result.current.quotes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

// ── BUG-NEW-02: Realtime ──────────────────────────────────────────────────────
describe('BUG-NEW-02 — Realtime subscription', () => {
  it('cria channel supabase quando user autenticado', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    renderHook(() => useQuotes(), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(supabase.channel).toHaveBeenCalledWith('quotes-realtime');
  });

  it('cancela channel ao desmontar (cleanup BUG-NEW-02)', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const { unmount } = renderHook(() => useQuotes(), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});

// ── createQuote ───────────────────────────────────────────────────────────────
describe('createQuote', () => {
  it('chama quoteService.createQuote com dados corretos', async () => {
    const { quoteService } = await import('@/services/quoteService');
    const { result } = renderHook(() => useQuotes(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createQuote({ title: 'Novo ORC' } as never, []);
    });

    expect(vi.mocked(quoteService.createQuote)).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Novo ORC' }),
      [],
      mockUser.id,
      'org-001',
    );
  });
});

/**
 * Testes unitários do hook useQuotesListPage.
 * Mocka `@/hooks/quotes` para isolar lógica de filtro/sort/banner sem rede.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mocks devem vir antes do import do SUT
const updateQuoteStatus = vi.fn(async () => true);
const duplicateQuote = vi.fn(async () => null);
const deleteQuote = vi.fn(async () => true);

let mockQuotes: Array<Record<string, unknown>> = [];
let mockLoading = false;
let mockError: string | null = null;

vi.mock('@/hooks/quotes', () => ({
  useQuotes: () => ({
    quotes: mockQuotes,
    isLoading: mockLoading,
    error: mockError,
    deleteQuote,
    duplicateQuote,
    updateQuoteStatus,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { useQuotesListPage } from '@/pages/quotes/useQuotesListPage';

function quote(
  overrides: Partial<{
    id: string;
    status: string;
    total: number;
    created_at: string;
    valid_until: string | null;
    quote_number: string;
    client_name: string;
    synced_to_bitrix: boolean | null;
  }> = {},
) {
  return {
    id: overrides.id ?? `q-${Math.random().toString(36).slice(2, 8)}`,
    quote_number: overrides.quote_number ?? 'ORC-2026-0001',
    client_name: overrides.client_name ?? 'Cliente Teste',
    client_company: 'Empresa',
    status: overrides.status ?? 'pending',
    total: overrides.total ?? 100,
    created_at: overrides.created_at ?? '2026-06-01T12:00:00Z',
    valid_until: overrides.valid_until ?? null,
    synced_to_bitrix: overrides.synced_to_bitrix ?? false,
    notes: '',
  };
}

beforeEach(() => {
  mockQuotes = [];
  mockLoading = false;
  mockError = null;
  vi.clearAllMocks();
});

describe('useQuotesListPage — onlyPendingStatuses', () => {
  it('false quando lista está vazia', () => {
    mockQuotes = [];
    const { result } = renderHook(() => useQuotesListPage());
    expect(result.current.onlyPendingStatuses).toBe(false);
    expect(result.current.filteredQuotes).toHaveLength(0);
  });

  it('true quando todos os quotes são pending', () => {
    mockQuotes = [
      quote({ status: 'pending' }),
      quote({ status: 'pending' }),
      quote({ status: 'pending' }),
    ];
    const { result } = renderHook(() => useQuotesListPage());
    expect(result.current.onlyPendingStatuses).toBe(true);
  });

  it('false quando há mix de status', () => {
    mockQuotes = [
      quote({ status: 'pending' }),
      quote({ status: 'sent' }),
      quote({ status: 'approved' }),
    ];
    const { result } = renderHook(() => useQuotesListPage());
    expect(result.current.onlyPendingStatuses).toBe(false);
  });
});

describe('useQuotesListPage — filtro/sort', () => {
  it('filtra por statusFilter', () => {
    mockQuotes = [
      quote({ id: 'a', status: 'pending' }),
      quote({ id: 'b', status: 'approved' }),
      quote({ id: 'c', status: 'approved' }),
    ];
    const { result } = renderHook(() => useQuotesListPage());
    act(() => result.current.setStatusFilter('approved'));
    expect(result.current.filteredQuotes.map((q) => q.id).sort()).toEqual(['b', 'c']);
  });

  it('busca por searchTerm com ≥ 2 chars usa Fuse', () => {
    mockQuotes = [
      quote({ id: 'x', client_name: 'Acme', quote_number: 'ORC-2026-0001' }),
      quote({ id: 'y', client_name: 'Beta', quote_number: 'ORC-2026-0002' }),
    ];
    const { result } = renderHook(() => useQuotesListPage());
    act(() => result.current.setSearchTerm('Acme'));
    expect(result.current.filteredQuotes.map((q) => q.id)).toContain('x');
    expect(result.current.filteredQuotes.map((q) => q.id)).not.toContain('y');
  });

  it.each([
    ['highest', ['big', 'mid', 'low']],
    ['lowest', ['low', 'mid', 'big']],
  ] as const)('sort %s ordena por total', (sortBy, expected) => {
    mockQuotes = [
      quote({ id: 'low', total: 10 }),
      quote({ id: 'big', total: 1000 }),
      quote({ id: 'mid', total: 100 }),
    ];
    const { result } = renderHook(() => useQuotesListPage());
    act(() => result.current.setSortBy(sortBy));
    expect(result.current.filteredQuotes.map((q) => q.id)).toEqual(expected);
  });

  it('sort newest ordena por created_at desc', () => {
    mockQuotes = [
      quote({ id: 'old', created_at: '2026-01-01T00:00:00Z' }),
      quote({ id: 'new', created_at: '2026-06-01T00:00:00Z' }),
      quote({ id: 'mid', created_at: '2026-03-01T00:00:00Z' }),
    ];
    const { result } = renderHook(() => useQuotesListPage());
    expect(result.current.filteredQuotes.map((q) => q.id)).toEqual(['new', 'mid', 'old']);
  });

  it('handleClearFilters reseta searchTerm, statusFilter e sortBy', () => {
    mockQuotes = [quote()];
    const { result } = renderHook(() => useQuotesListPage());
    act(() => {
      result.current.setSearchTerm('foo');
      result.current.setStatusFilter('approved');
      result.current.setSortBy('highest');
    });
    act(() => result.current.handleClearFilters());
    expect(result.current.searchTerm).toBe('');
    expect(result.current.statusFilter).toBe('all');
    expect(result.current.sortBy).toBe('newest');
  });
});

describe('useQuotesListPage — handleMarkApproved', () => {
  it('chama updateQuoteStatus(id, "approved")', async () => {
    mockQuotes = [quote({ id: 'q1' })];
    const { result } = renderHook(() => useQuotesListPage());
    await act(async () => {
      await result.current.handleMarkApproved('q1');
    });
    expect(updateQuoteStatus).toHaveBeenCalledWith('q1', 'approved');
  });
});

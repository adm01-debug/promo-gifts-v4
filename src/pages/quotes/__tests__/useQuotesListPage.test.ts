/**
 * Testes unitários do hook useQuotesListPage.
 * Mocka `@/hooks/quotes` para isolar lógica de filtro/sort/banner sem rede.
 *
 * NOTA (URL state): a partir da introdução de `useListUrlState`, o hook
 * consome `useSearchParams` — precisamos envolver o `renderHook` em
 * `MemoryRouter`. A busca (`q`) usa debounce de 250ms, então testes que
 * dependem do filtro por texto usam fake timers p/ avançar o relógio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React, { type ReactNode } from 'react';

// Mocks devem vir antes do import do SUT
// eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
const updateQuoteStatus = vi.fn(async () => true);
// eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
const duplicateQuote = vi.fn(async () => null);
// eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
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

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { useQuotesListPage } from '@/pages/quotes/useQuotesListPage';

// Wrapper com MemoryRouter — obrigatório para hooks que usam useSearchParams.
const wrapper = ({ children }: { children: ReactNode }) =>
  React.createElement(MemoryRouter, { initialEntries: ['/orcamentos'] }, children);

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
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    expect(result.current.onlyPendingStatuses).toBe(false);
    expect(result.current.filteredQuotes).toHaveLength(0);
  });

  it('true quando todos os quotes são pending', () => {
    mockQuotes = [
      quote({ status: 'pending' }),
      quote({ status: 'pending' }),
      quote({ status: 'pending' }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    expect(result.current.onlyPendingStatuses).toBe(true);
  });

  it('false quando há mix de status', () => {
    mockQuotes = [
      quote({ status: 'pending' }),
      quote({ status: 'sent' }),
      quote({ status: 'approved' }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
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
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setStatusFilter('approved'));
    expect(
      result.current.filteredQuotes.map((q) => q.id).sort((a, b) => a.localeCompare(b)),
    ).toEqual(['b', 'c']);
  });

  it('busca por searchTerm com ≥ 2 chars usa Fuse (após debounce)', async () => {
    mockQuotes = [
      quote({ id: 'x', client_name: 'Acme', quote_number: 'ORC-2026-0001' }),
      quote({ id: 'y', client_name: 'Beta', quote_number: 'ORC-2026-0002' }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setSearchTerm('Acme'));
    // A busca (`q`) usa debounce 250ms — filteredQuotes só reage após o timer.
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      const ids = result.current.filteredQuotes.map((q) => q.id);
      expect(ids).toContain('x');
      expect(ids).not.toContain('y');
    });
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
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setSortBy(sortBy));
    expect(result.current.filteredQuotes.map((q) => q.id)).toEqual(expected);
  });

  it('sort newest ordena por created_at desc', () => {
    mockQuotes = [
      quote({ id: 'old', created_at: '2026-01-01T00:00:00Z' }),
      quote({ id: 'new', created_at: '2026-06-01T00:00:00Z' }),
      quote({ id: 'mid', created_at: '2026-03-01T00:00:00Z' }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    expect(result.current.filteredQuotes.map((q) => q.id)).toEqual(['new', 'mid', 'old']);
  });

  it('handleClearFilters reseta searchTerm, statusFilter e sortBy', () => {
    mockQuotes = [quote()];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
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
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    await act(async () => {
      await result.current.handleMarkApproved('q1');
    });
    expect(updateQuoteStatus).toHaveBeenCalledWith('q1', 'approved');
  });
});

describe('useQuotesListPage — chips de sync (Bitrix)', () => {
  it('filtro "unsynced" retorna apenas pending && !synced_to_bitrix', () => {
    mockQuotes = [
      quote({ id: 'a', status: 'pending', synced_to_bitrix: false }),
      quote({ id: 'b', status: 'pending', synced_to_bitrix: true }),
      quote({ id: 'c', status: 'draft', synced_to_bitrix: false }),
      quote({ id: 'd', status: 'expired', synced_to_bitrix: false }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setStatusFilter('unsynced'));
    expect(result.current.filteredQuotes.map((q) => q.id)).toEqual(['a']);
  });

  it('filtro "pending" inclui sincronizados e não sincronizados (fallback por status)', () => {
    mockQuotes = [
      quote({ id: 'a', status: 'pending', synced_to_bitrix: true }),
      quote({ id: 'b', status: 'pending', synced_to_bitrix: false }),
      quote({ id: 'c', status: 'draft' }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setStatusFilter('pending'));
    expect(
      result.current.filteredQuotes.map((q) => q.id).sort((a, b) => a.localeCompare(b)),
    ).toEqual(['a', 'b']);
  });

  it('reset volta para "all" e mostra todos os orçamentos', () => {
    mockQuotes = [
      quote({ id: 'a', status: 'pending', synced_to_bitrix: true }),
      quote({ id: 'b', status: 'draft' }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setStatusFilter('created_synced'));
    expect(result.current.filteredQuotes).toHaveLength(1);
    act(() => result.current.handleClearFilters());
    expect(result.current.statusFilter).toBe('all');
    expect(result.current.filteredQuotes).toHaveLength(2);
  });

  it('sobreposição: pending sincronizado conta em "pending" E "created_synced" (soma > total)', () => {
    mockQuotes = [
      quote({ id: 'a', status: 'pending', synced_to_bitrix: true }),
      quote({ id: 'b', status: 'pending', synced_to_bitrix: true }),
      quote({ id: 'c', status: 'pending', synced_to_bitrix: false }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    act(() => result.current.setStatusFilter('pending'));
    const pendingIds = result.current.filteredQuotes
      .map((q) => q.id)
      .sort((a, b) => a.localeCompare(b));

    act(() => result.current.setStatusFilter('created_synced'));
    const syncedIds = result.current.filteredQuotes
      .map((q) => q.id)
      .sort((a, b) => a.localeCompare(b));

    expect(pendingIds).toEqual(['a', 'b', 'c']);
    expect(syncedIds).toEqual(['a', 'b']);
    // 'a' e 'b' aparecem em ambos → sobreposição confirmada
    expect(pendingIds).toEqual(expect.arrayContaining(syncedIds));
    // Soma das contagens dos chips > total real
    expect(pendingIds.length + syncedIds.length).toBeGreaterThan(mockQuotes.length);
  });

  it('fallback: synced_to_bitrix null/undefined é tratado como NÃO sincronizado', () => {
    mockQuotes = [
      // legado: campo ausente/indefinido
      { ...quote({ id: 'a', status: 'pending' }), synced_to_bitrix: undefined },
      // legado: campo null
      { ...quote({ id: 'b', status: 'pending' }), synced_to_bitrix: null },
      quote({ id: 'c', status: 'pending', synced_to_bitrix: true }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    act(() => result.current.setStatusFilter('created_synced'));
    expect(result.current.filteredQuotes.map((q) => q.id)).toEqual(['c']);

    act(() => result.current.setStatusFilter('unsynced'));
    expect(
      result.current.filteredQuotes.map((q) => q.id).sort((a, b) => a.localeCompare(b)),
    ).toEqual(['a', 'b']);
  });

  it('filtro "created_synced" retorna apenas pending && synced_to_bitrix === true', () => {
    mockQuotes = [
      quote({ id: 'a', status: 'pending', synced_to_bitrix: true }),
      quote({ id: 'b', status: 'pending', synced_to_bitrix: false }),
      quote({ id: 'c', status: 'approved', synced_to_bitrix: true }),
      quote({ id: 'd', status: 'pending', synced_to_bitrix: null }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setStatusFilter('created_synced'));
    expect(result.current.filteredQuotes.map((q) => q.id)).toEqual(['a']);
  });

  it('sobreposição: created_synced ⊂ pending', () => {
    mockQuotes = [
      quote({ id: 'a', status: 'pending', synced_to_bitrix: true }),
      quote({ id: 'b', status: 'pending', synced_to_bitrix: false }),
      quote({ id: 'c', status: 'approved', synced_to_bitrix: true }),
    ];
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    act(() => result.current.setStatusFilter('created_synced'));
    const cs = result.current.filteredQuotes.map((q) => q.id).sort((a, b) => a.localeCompare(b));
    act(() => result.current.setStatusFilter('pending'));
    const p = result.current.filteredQuotes.map((q) => q.id).sort((a, b) => a.localeCompare(b));

    expect(cs).toEqual(['a']);
    expect(p).toEqual(expect.arrayContaining(cs));
  });
});

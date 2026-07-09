/**
 * Testes unitários — sincronização de query string em useQuotesListPage.
 *
 * Contrato validado:
 *  - `status`, `sort` e `q` (debounced) são lidos da URL na montagem.
 *  - Chamar os setters escreve na URL via replaceState.
 *  - Valores default (`status=all`, `sort=newest`, `q=""`) são removidos da URL.
 *  - Deep-link `?q=foo&status=approved&sort=highest` restaura estado sem
 *    esperar debounce para o input controlado.
 *  - Após reload (nova montagem com mesma URL), o estado é reidratado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import React from 'react';

vi.mock('@/hooks/quotes', () => ({
  useQuotes: () => ({
    quotes: [],
    isLoading: false,
    isFetching: false,
    error: null,
    deleteQuote: vi.fn(),
    duplicateQuote: vi.fn(),
    updateQuoteStatus: vi.fn(),
    createQuote: vi.fn(),
    fetchQuote: vi.fn(),
    fetchQuotes: vi.fn(),
  }),
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { useQuotesListPage } from '@/pages/quotes/useQuotesListPage';

function makeWrapper(initialUrl: string) {
  let currentSearch = '';
  const LocationProbe = () => {
    const loc = useLocation();
    currentSearch = loc.search;
    return null;
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>
      <LocationProbe />
      {children}
    </MemoryRouter>
  );
  return { wrapper, getSearch: () => currentSearch };
}

beforeEach(() => vi.clearAllMocks());

describe('useQuotesListPage — sincronização com query string', () => {
  it('lê defaults quando URL não tem params', () => {
    const { wrapper } = makeWrapper('/orcamentos');
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    expect(result.current.statusFilter).toBe('all');
    expect(result.current.sortBy).toBe('newest');
    expect(result.current.searchTerm).toBe('');
  });

  it('deep-link restaura status, sort e q sem esperar debounce', () => {
    const { wrapper } = makeWrapper(
      '/orcamentos?status=approved&sort=highest&q=teste',
    );
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    expect(result.current.statusFilter).toBe('approved');
    expect(result.current.sortBy).toBe('highest');
    // q é copiado no initial state — sem esperar debounce
    expect(result.current.searchTerm).toBe('teste');
  });

  it('setStatusFilter escreve na URL e removê-lo com "all" limpa da URL', async () => {
    const { wrapper, getSearch } = makeWrapper('/orcamentos');
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    act(() => result.current.setStatusFilter('approved'));
    await waitFor(() => expect(getSearch()).toMatch(/status=approved/));

    act(() => result.current.setStatusFilter('all'));
    await waitFor(() => expect(getSearch()).not.toMatch(/status=/));
  });

  it('setSortBy escreve na URL e default "newest" é limpo', async () => {
    const { wrapper, getSearch } = makeWrapper('/orcamentos');
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    act(() => result.current.setSortBy('highest'));
    await waitFor(() => expect(getSearch()).toMatch(/sort=highest/));

    act(() => result.current.setSortBy('newest'));
    await waitFor(() => expect(getSearch()).not.toMatch(/sort=/));
  });

  it('setSearchTerm sincroniza para URL após o debounce', async () => {
    vi.useFakeTimers();
    const { wrapper, getSearch } = makeWrapper('/orcamentos');
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    act(() => result.current.setSearchTerm('foo'));

    // Antes do debounce (~250ms), URL não tem q.
    expect(getSearch()).not.toMatch(/q=foo/);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Após debounce, URL contém q=foo.
    await waitFor(() => expect(getSearch()).toMatch(/q=foo/));

    // Limpando volta para vazio → remove da URL.
    act(() => result.current.setSearchTerm(''));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await waitFor(() => expect(getSearch()).not.toMatch(/q=/));
    vi.useRealTimers();
  });

  it('remonta o hook (simula reload) — estado reidrata da URL', () => {
    const { wrapper } = makeWrapper(
      '/orcamentos?status=draft&sort=oldest&q=abc',
    );
    const { result, unmount } = renderHook(() => useQuotesListPage(), {
      wrapper,
    });
    expect(result.current.statusFilter).toBe('draft');
    expect(result.current.sortBy).toBe('oldest');
    expect(result.current.searchTerm).toBe('abc');
    unmount();

    // Segunda montagem com a mesma URL — reidrata igual.
    const remount = renderHook(() => useQuotesListPage(), { wrapper });
    expect(remount.result.current.statusFilter).toBe('draft');
    expect(remount.result.current.sortBy).toBe('oldest');
    expect(remount.result.current.searchTerm).toBe('abc');
  });
});

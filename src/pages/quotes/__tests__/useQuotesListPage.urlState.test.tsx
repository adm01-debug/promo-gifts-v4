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
import React, { type ReactNode } from 'react';

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
    const { wrapper, getSearch } = makeWrapper('/orcamentos');
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    act(() => result.current.setSearchTerm('foo'));

    // Antes do debounce (~250ms) a URL não deve refletir ainda.
    expect(getSearch()).not.toMatch(/q=foo/);

    // Após debounce (~250ms) a URL passa a refletir.
    await waitFor(() => expect(getSearch()).toMatch(/q=foo/), { timeout: 1500 });

    // Limpando volta para vazio → remove da URL.
    act(() => result.current.setSearchTerm(''));
    await waitFor(() => expect(getSearch()).not.toMatch(/q=/), { timeout: 1500 });
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

  it('handleClearFilters remove status, sort e q da URL', async () => {
    const { wrapper, getSearch } = makeWrapper(
      '/orcamentos?status=approved&sort=highest&q=teste',
    );
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    // Precondição: params estão na URL.
    expect(getSearch()).toMatch(/status=approved/);
    expect(getSearch()).toMatch(/sort=highest/);
    expect(getSearch()).toMatch(/q=teste/);

    act(() => result.current.handleClearFilters());

    // URL fica sem nenhum dos params de filtro.
    await waitFor(() => {
      expect(getSearch()).not.toMatch(/status=/);
      expect(getSearch()).not.toMatch(/sort=/);
      expect(getSearch()).not.toMatch(/q=/);
    });

    // Estado interno volta aos defaults.
    expect(result.current.statusFilter).toBe('all');
    expect(result.current.sortBy).toBe('newest');
    expect(result.current.searchTerm).toBe('');
  });

  it('após handleClearFilters, remontar (reload) mantém URL limpa', () => {
    // Simula: usuário clicou em "Limpar filtros" → URL limpa → reload.
    // Recriamos o cenário montando o hook direto em `/orcamentos` (sem params).
    const { wrapper, getSearch } = makeWrapper('/orcamentos');
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    expect(getSearch()).toBe('');
    expect(result.current.statusFilter).toBe('all');
    expect(result.current.sortBy).toBe('newest');
    expect(result.current.searchTerm).toBe('');
  });

  it('handleClearFilters é no-op quando URL já está limpa', () => {
    const { wrapper, getSearch } = makeWrapper('/orcamentos');
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    act(() => result.current.handleClearFilters());
    expect(getSearch()).toBe('');
  });
});


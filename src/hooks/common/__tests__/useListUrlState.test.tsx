/**
 * Testes unitários — `useListUrlState`.
 *
 * Cobre os contratos consumidos por `/carrinhos` (CartsListPage) e
 * `/orcamentos` (useQuotesListPage):
 *  - `clearAll()` remove TODOS os params gerenciados da URL (deadline/sort/q
 *    para carrinhos; status/sort/q para orçamentos).
 *  - Estado limpo sobrevive a reload (remontar o hook com URL limpa).
 *  - Deep-link com `q` na URL restaura o input imediatamente e o valor
 *    debounced (250ms) chega ao `values.q` após o debounce.
 *  - Digitação não polui a URL antes de ~250ms.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import React, { type ReactNode } from 'react';

import { useListUrlState } from '@/hooks/common/useListUrlState';

// Config idêntica à usada em CartsListPage.
const CARTS_KEYS = { status: 'all', deadline: 'all', sort: 'recent', q: '' } as const;

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

describe('useListUrlState — contrato de /carrinhos (deadline/sort/q)', () => {
  it('clearAll remove deadline, sort e q da URL', async () => {
    const { wrapper, getSearch } = makeWrapper(
      '/carrinhos?deadline=overdue&sort=deadline-asc&q=abc&status=em_separacao',
    );
    const { result } = renderHook(
      () => useListUrlState({ keys: CARTS_KEYS, searchKey: 'q', debounceMs: 250 }),
      { wrapper },
    );

    // Precondição.
    expect(getSearch()).toMatch(/deadline=overdue/);
    expect(getSearch()).toMatch(/sort=deadline-asc/);
    expect(getSearch()).toMatch(/q=abc/);
    expect(getSearch()).toMatch(/status=em_separacao/);

    act(() => result.current.clearAll());

    await waitFor(() => {
      expect(getSearch()).not.toMatch(/deadline=/);
      expect(getSearch()).not.toMatch(/sort=/);
      expect(getSearch()).not.toMatch(/q=/);
      expect(getSearch()).not.toMatch(/status=/);
    });

    // Estado interno em defaults.
    expect(result.current.values.deadline).toBe('all');
    expect(result.current.values.sort).toBe('recent');
    expect(result.current.values.q).toBe('');
    expect(result.current.values.status).toBe('all');
    expect(result.current.searchInput).toBe('');
  });

  it('após clearAll, remontar (simula reload) mantém URL limpa', () => {
    const { wrapper, getSearch } = makeWrapper('/carrinhos');
    const { result } = renderHook(
      () => useListUrlState({ keys: CARTS_KEYS, searchKey: 'q' }),
      { wrapper },
    );
    expect(getSearch()).toBe('');
    expect(result.current.values.deadline).toBe('all');
    expect(result.current.values.sort).toBe('recent');
    expect(result.current.values.q).toBe('');
  });

  it('preserva params NÃO gerenciados quando clearAll é chamado', async () => {
    // Só limpa as chaves declaradas em `keys`. Params externos (paginação,
    // rastreio, etc.) devem permanecer intactos.
    const { wrapper, getSearch } = makeWrapper(
      '/carrinhos?deadline=overdue&page=2&utm=email',
    );
    const { result } = renderHook(
      () => useListUrlState({ keys: CARTS_KEYS, searchKey: 'q' }),
      { wrapper },
    );

    act(() => result.current.clearAll());
    await waitFor(() => {
      expect(getSearch()).not.toMatch(/deadline=/);
    });
    expect(getSearch()).toMatch(/page=2/);
    expect(getSearch()).toMatch(/utm=email/);
  });
});

describe('useListUrlState — debounce da busca (`q`, 250ms)', () => {
  it('deep-link com q na URL restaura o input imediatamente', () => {
    const { wrapper } = makeWrapper('/carrinhos?q=acme');
    const { result } = renderHook(
      () => useListUrlState({ keys: CARTS_KEYS, searchKey: 'q', debounceMs: 250 }),
      { wrapper },
    );
    // Input controlado reflete a URL sem esperar debounce (initial state).
    expect(result.current.searchInput).toBe('acme');
    expect(result.current.values.q).toBe('acme');
  });

  it('digitação só grava na URL após ~250ms (não polui durante digitação)', async () => {
    const { wrapper, getSearch } = makeWrapper('/carrinhos');
    const { result } = renderHook(
      () => useListUrlState({ keys: CARTS_KEYS, searchKey: 'q', debounceMs: 250 }),
      { wrapper },
    );

    act(() => result.current.setSearchInput('xy'));
    // Imediatamente após: URL AINDA não deve ter `q=xy`.
    expect(getSearch()).not.toMatch(/q=xy/);

    // Após o debounce: URL reflete.
    await waitFor(() => expect(getSearch()).toMatch(/q=xy/), { timeout: 1500 });
  });

  it('remontar (simula reload) com q na URL — valor restaura e values.q reflete', async () => {
    // Simula reload: nova montagem do hook com a mesma URL persistida.
    const { wrapper } = makeWrapper('/carrinhos?q=abc&deadline=overdue');
    const { result } = renderHook(
      () => useListUrlState({ keys: CARTS_KEYS, searchKey: 'q', debounceMs: 250 }),
      { wrapper },
    );

    // Input reidratado imediatamente.
    expect(result.current.searchInput).toBe('abc');
    // `values.q` (usado pelo filtro/lista) também.
    expect(result.current.values.q).toBe('abc');
    // Deadline preservado.
    expect(result.current.values.deadline).toBe('overdue');

    // Após o debounce, valor permanece consistente (não sobrescreveu com '').
    await waitFor(
      () => {
        expect(result.current.values.q).toBe('abc');
        expect(result.current.searchInput).toBe('abc');
      },
      { timeout: 1500 },
    );
  });
});

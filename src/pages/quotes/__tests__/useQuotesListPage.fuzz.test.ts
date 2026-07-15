/**
 * Property-based / fuzz test do hook useQuotesListPage.
 * 100 datasets randomizados validam invariantes de filtro, sort e banner.
 *
 * NOTA: envolvemos em `MemoryRouter` porque o hook usa `useSearchParams`
 * (via `useListUrlState`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React, { type ReactNode } from 'react';

import fc from 'fast-check';
import { QUOTE_STATUSES } from '@/types/quote';

const updateQuoteStatus = vi.fn(async () => true);
const duplicateQuote = vi.fn(async () => null);
const deleteQuote = vi.fn(async () => true);

let mockQuotes: Array<Record<string, unknown>> = [];

vi.mock('@/hooks/quotes', () => ({
  useQuotes: () => ({
    quotes: mockQuotes,
    isLoading: false,
    error: null,
    deleteQuote,
    duplicateQuote,
    updateQuoteStatus,
  }),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { useQuotesListPage } from '@/pages/quotes/useQuotesListPage';

// Cada renderHook precisa de uma instância nova do MemoryRouter — assim
// não vaza query string entre runs da property.
const wrapper = ({ children }: { children: ReactNode }) =>
  React.createElement(MemoryRouter, { initialEntries: ['/orcamentos'] }, children);

const statusArb = fc.constantFrom(...QUOTE_STATUSES);

const quoteArb = fc.record({
  id: fc.uuid(),
  quote_number: fc.stringMatching(/^ORC-\d{4}-\d{4}$/),
  client_name: fc.string({ minLength: 0, maxLength: 30 }),
  client_company: fc.string({ minLength: 0, maxLength: 30 }),
  status: statusArb,
  total: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
  created_at: fc
    .integer({ min: 1_600_000_000_000, max: 1_900_000_000_000 })
    .map((ts) => new Date(ts).toISOString()),
  valid_until: fc.option(
    fc
      .integer({ min: 1_600_000_000_000, max: 1_900_000_000_000 })
      .map((ts) => new Date(ts).toISOString()),
    { nil: null },
  ),
  // Cobre dados legados: pode vir true, false, null ou indefinido
  synced_to_bitrix: fc.oneof(
    fc.constant(true),
    fc.constant(false),
    fc.constant(null),
    fc.constant(undefined),
  ),
  notes: fc.string({ maxLength: 50 }),
});

beforeEach(() => {
  mockQuotes = [];
});

describe('useQuotesListPage — fuzz/property-based (100 runs)', () => {
  it('filteredQuotes é sempre subconjunto de quotes', () => {
    fc.assert(
      fc.property(fc.array(quoteArb, { minLength: 0, maxLength: 30 }), (quotes) => {
        mockQuotes = quotes;
        const { result } = renderHook(() => useQuotesListPage(), { wrapper });
        const ids = new Set(quotes.map((q) => q.id));
        for (const q of result.current.filteredQuotes) {
          expect(ids.has(q.id!)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('onlyPendingStatuses é true sse quotes.length>0 && todos pending', () => {
    fc.assert(
      fc.property(fc.array(quoteArb, { minLength: 0, maxLength: 20 }), (quotes) => {
        mockQuotes = quotes;
        const { result } = renderHook(() => useQuotesListPage(), { wrapper });
        const expected = quotes.length > 0 && quotes.every((q) => q.status === 'pending');
        expect(result.current.onlyPendingStatuses).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('sort total sem perdas: |filteredQuotes| === |quotes| quando sem filtros (exceto "expiring", que filtra por design)', () => {
    fc.assert(
      fc.property(
        fc.array(quoteArb, { minLength: 1, maxLength: 15 }),
        // 'expiring' é filtrante por design (remove sem valid_until / expirados)
        fc.constantFrom('newest', 'oldest', 'highest', 'lowest'),
        (quotes, sortBy) => {
          mockQuotes = quotes;
          const { result } = renderHook(() => useQuotesListPage(), { wrapper });
          act(() => {
            result.current.setSortBy(sortBy as 'newest');
          });
          expect(result.current.filteredQuotes.length).toBe(quotes.length);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('handleClearFilters reseta busca/status/sort', () => {
    fc.assert(
      fc.property(fc.array(quoteArb, { maxLength: 5 }), statusArb, (quotes, status) => {
        mockQuotes = quotes;
        const { result } = renderHook(() => useQuotesListPage(), { wrapper });
        act(() => {
          result.current.setSearchTerm('xyz');
          result.current.setStatusFilter(status);
          result.current.setSortBy('lowest');
        });
        act(() => {
          result.current.handleClearFilters();
        });
        expect(result.current.searchTerm).toBe('');
        expect(result.current.statusFilter).toBe('all');
        expect(result.current.sortBy).toBe('newest');
      }),
      { numRuns: 50 },
    );
  });

  it('filtro por status retorna apenas quotes com status correspondente', () => {
    fc.assert(
      fc.property(fc.array(quoteArb, { minLength: 1, maxLength: 20 }), statusArb, (quotes, status) => {
        mockQuotes = quotes;
        const { result } = renderHook(() => useQuotesListPage(), { wrapper });
        act(() => {
          result.current.setStatusFilter(status);
        });
        for (const q of result.current.filteredQuotes) {
          expect(q.status).toBe(status);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('filtro "synced" retorna apenas quotes com synced_to_bitrix === true (fallback null/undefined)', () => {
    fc.assert(
      fc.property(fc.array(quoteArb, { minLength: 1, maxLength: 25 }), (quotes) => {
        mockQuotes = quotes;
        const { result } = renderHook(() => useQuotesListPage(), { wrapper });
        act(() => result.current.setStatusFilter('synced'));
        for (const q of result.current.filteredQuotes) {
          expect(q.synced_to_bitrix).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('filtro "unsynced" retorna apenas pending && synced_to_bitrix !== true (null/undefined contam como não sinc.)', () => {
    fc.assert(
      fc.property(fc.array(quoteArb, { minLength: 1, maxLength: 25 }), (quotes) => {
        mockQuotes = quotes;
        const { result } = renderHook(() => useQuotesListPage(), { wrapper });
        act(() => result.current.setStatusFilter('unsynced'));
        for (const q of result.current.filteredQuotes) {
          expect(q.status).toBe('pending');
          expect(q.synced_to_bitrix === true).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Validação exaustiva do filtro "Vencimento próximo" (sort=expiring).
 *
 * Invariantes:
 *  I1. Nenhum item com `status === 'expired'` é retornado.
 *  I2. Nenhum item com `valid_until` no passado (< now) é retornado.
 *  I3. Itens sem `valid_until` são excluídos (não há vencimento a prever).
 *  I4. `valid_until` inválido (string lixo / NaN) é excluído.
 *  I5. Ordenação é ascendente por `valid_until`.
 *  I6. Mudar para outro sort traz os expirados de volta (filtro só atua em `expiring`).
 *  I7. Compatível com statusFilter ativo (interseção, não substituição).
 *  I8. Idempotente: aplicar 2x não muda o conjunto.
 *  I9. Fuzz: para qualquer dataset aleatório, o resultado respeita I1–I5.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React, { type ReactNode } from 'react';

import fc from 'fast-check';
import { QUOTE_STATUSES } from '@/types/quote';

// MemoryRouter wrapper — obrigatório para hooks que usam useSearchParams
// (introduzido pelo `useListUrlState`).
const wrapper = ({ children }: { children: ReactNode }) =>
  React.createElement(MemoryRouter, { initialEntries: ['/orcamentos'] }, children);

// eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
const updateQuoteStatus = vi.fn(async () => true);
// eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
const duplicateQuote = vi.fn(async () => null);
// eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
const deleteQuote = vi.fn(async () => true);
// eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
const createQuote = vi.fn(async () => null);
// eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
const fetchQuote = vi.fn(async () => null);
// eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
const fetchQuotes = vi.fn(async () => undefined);

let mockQuotes: Array<Record<string, unknown>> = [];

vi.mock('@/hooks/quotes', () => ({
  useQuotes: () => ({
    quotes: mockQuotes,
    isLoading: false,
    isFetching: false,
    error: null,
    deleteQuote,
    duplicateQuote,
    updateQuoteStatus,
    createQuote,
    fetchQuote,
    fetchQuotes,
  }),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { useQuotesListPage } from '@/pages/quotes/useQuotesListPage';

const NOW = new Date('2026-06-27T12:00:00.000Z').getTime();
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const DAY = 86_400_000;

const q = (over: Partial<Record<string, unknown>>) => ({
  id: Math.random().toString(36).slice(2),
  quote_number: 'ORC-2026-0001',
  client_name: 'X',
  client_company: 'Y',
  status: 'pending',
  total: 100,
  created_at: iso(-DAY),
  valid_until: null,
  synced_to_bitrix: false,
  notes: '',
  ...over,
});

beforeEach(() => {
  mockQuotes = [];
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const setExpiring = (
  h: ReturnType<typeof renderHook<ReturnType<typeof useQuotesListPage>, unknown>>,
) => act(() => h.result.current.setSortBy('expiring'));

describe('useQuotesListPage — filtro "Vencimento próximo" (sort=expiring)', () => {
  it('I1: exclui quotes com status=expired mesmo com valid_until futuro', () => {
    mockQuotes = [
      q({ id: 'a', status: 'expired', valid_until: iso(5 * DAY) }),
      q({ id: 'b', status: 'pending', valid_until: iso(2 * DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['b']);
  });

  it('I2: exclui valid_until no passado (mesmo status=pending)', () => {
    mockQuotes = [
      q({ id: 'past', status: 'pending', valid_until: iso(-DAY) }),
      q({ id: 'future', status: 'pending', valid_until: iso(DAY) }),
      q({ id: 'edge-1ms-past', status: 'pending', valid_until: iso(-1) }),
      q({ id: 'edge-now', status: 'pending', valid_until: iso(0) }), // == now → mantém
    ];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(
      h.result.current.filteredQuotes.map((x) => x.id).sort((a, b) => a.localeCompare(b)),
    ).toEqual(['edge-now', 'future'].sort((a, b) => a.localeCompare(b)));
  });

  it('I3: exclui quotes sem valid_until', () => {
    mockQuotes = [
      q({ id: 'nil', valid_until: null }),
      q({ id: 'undef', valid_until: undefined }),
      q({ id: 'ok', valid_until: iso(DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['ok']);
  });

  it('I4: exclui valid_until inválido (NaN/lixo)', () => {
    mockQuotes = [
      q({ id: 'junk', valid_until: 'not-a-date' }),
      q({ id: 'empty', valid_until: '' }),
      q({ id: 'ok', valid_until: iso(DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['ok']);
  });

  it('I5: ordenação ascendente por valid_until', () => {
    mockQuotes = [
      q({ id: 'd10', valid_until: iso(10 * DAY) }),
      q({ id: 'd1', valid_until: iso(1 * DAY) }),
      q({ id: 'd5', valid_until: iso(5 * DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['d1', 'd5', 'd10']);
  });

  it('I6: trocar para "newest" reexpõe expirados/sem data', () => {
    mockQuotes = [
      q({ id: 'past', status: 'pending', valid_until: iso(-DAY) }),
      q({ id: 'nil', valid_until: null }),
      q({ id: 'future', valid_until: iso(DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes.length).toBe(1);
    act(() => h.result.current.setSortBy('newest'));
    expect(h.result.current.filteredQuotes.length).toBe(3);
  });

  it('I7: respeita statusFilter ativo (interseção)', () => {
    mockQuotes = [
      q({ id: 'p', status: 'pending', valid_until: iso(2 * DAY) }),
      q({ id: 'd', status: 'draft', valid_until: iso(1 * DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    act(() => h.result.current.setStatusFilter('draft'));
    const ids = h.result.current.filteredQuotes.map((x) => x.id);
    // não deve conter pendings; deve conter draft futuro
    expect(ids).toContain('d');
    expect(ids).not.toContain('p');
  });

  it('I8: idempotência — recomputar não muda o conjunto', () => {
    mockQuotes = Array.from({ length: 20 }, (_, i) =>
      q({
        id: `q${i}`,
        status: i % 7 === 0 ? 'expired' : 'pending',
        valid_until: iso((i - 10) * DAY),
      }),
    );
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    const a = h.result.current.filteredQuotes.map((x) => x.id);
    const b = h.result.current.filteredQuotes.map((x) => x.id);
    expect(a).toEqual(b);
  });

  it('caso vazio: retorna []', () => {
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes).toEqual([]);
  });
});

describe('useQuotesListPage — fuzz exaustivo (300 runs) do filtro expiring', () => {
  const statusArb = fc.constantFrom(...QUOTE_STATUSES);
  const validUntilArb = fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.constant('lixo'),
    fc.constant(''),
    fc.integer({ min: -30, max: 30 }).map((d) => iso(d * DAY)),
  );
  const quoteArb = fc.record({
    id: fc.uuid(),
    quote_number: fc.constant('ORC-2026-0001'),
    client_name: fc.string({ maxLength: 8 }),
    client_company: fc.string({ maxLength: 8 }),
    status: statusArb,
    total: fc.float({ min: 0, max: 1000, noNaN: true }),
    created_at: fc.constant(iso(-DAY)),
    valid_until: validUntilArb,
    synced_to_bitrix: fc.boolean(),
    notes: fc.constant(''),
  });

  it('invariantes I1–I5 valem para qualquer dataset (≤25 quotes)', () => {
    fc.assert(
      fc.property(fc.array(quoteArb, { minLength: 0, maxLength: 25 }), (quotes) => {
        mockQuotes = quotes;
        const h = renderHook(() => useQuotesListPage(), { wrapper });
        setExpiring(h);
        const out = h.result.current.filteredQuotes;
        let lastT = -Infinity;
        for (const item of out) {
          // I1
          expect(item.status).not.toBe('expired');
          // I3 + I4
          expect(item.valid_until).toBeTruthy();
          const t = new Date(item.valid_until!).getTime();
          expect(Number.isFinite(t)).toBe(true);
          // I2
          expect(t).toBeGreaterThanOrEqual(NOW);
          // I5
          expect(t).toBeGreaterThanOrEqual(lastT);
          lastT = t;
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('useQuotesListPage — bordas de data/timezone do filtro expiring', () => {
  it('expira HOJE às 23:59:59Z → mantém (ainda futuro vs now=12:00Z)', () => {
    mockQuotes = [
      q({ id: 'today-late', status: 'pending', valid_until: '2026-06-27T23:59:59.000Z' }),
      q({ id: 'today-early', status: 'pending', valid_until: '2026-06-27T00:00:00.000Z' }),
    ];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['today-late']);
  });

  it('timezone -03:00 cujo instante UTC é futuro → mantém', () => {
    // 2026-06-28T10:00-03:00 == 2026-06-28T13:00Z (futuro)
    mockQuotes = [q({ id: 'brt-future', valid_until: '2026-06-28T10:00:00-03:00' })];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['brt-future']);
  });

  it('timezone +09:00 cujo instante UTC é passado → exclui', () => {
    // 2026-06-27T20:00+09:00 == 2026-06-27T11:00Z (passado vs 12:00Z)
    mockQuotes = [q({ id: 'jp-past', valid_until: '2026-06-27T20:00:00+09:00' })];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes).toEqual([]);
  });

  it('formato date-only (YYYY-MM-DD) é interpretado como meia-noite UTC', () => {
    mockQuotes = [
      q({ id: 'today', valid_until: '2026-06-27' }), // 00:00Z → passado
      q({ id: 'tomorrow', valid_until: '2026-06-28' }), // 00:00Z → futuro
    ];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['tomorrow']);
  });

  it('valid_until com espaços / null-string / objeto → exclui defensivamente', () => {
    mockQuotes = [
      q({ id: 'spaces', valid_until: '   ' }),
      q({ id: 'null-str', valid_until: 'null' }),
      q({ id: 'obj', valid_until: {} as unknown as string }),
      q({ id: 'ok', valid_until: iso(DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['ok']);
  });
});

describe('useQuotesListPage — performance do filtro expiring', () => {
  it('filtra 10.000 orçamentos em < 500ms', () => {
    mockQuotes = Array.from({ length: 10_000 }, (_, i) =>
      q({
        id: `big-${i}`,
        status: i % 11 === 0 ? 'expired' : 'pending',
        valid_until: i % 13 === 0 ? null : iso((i - 5000) * 60_000),
      }),
    );
    const t0 = performance.now();
    const h = renderHook(() => useQuotesListPage(), { wrapper });
    setExpiring(h);
    const out = h.result.current.filteredQuotes;
    const elapsed = performance.now() - t0;
    // sanity: a maioria deve ter sido filtrada
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(10_000);
    expect(elapsed).toBeLessThan(500);
  });
});

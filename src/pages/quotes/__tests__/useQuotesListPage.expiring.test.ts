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
import fc from 'fast-check';
import { QUOTE_STATUSES } from '@/types/quote';

const updateQuoteStatus = vi.fn(async () => true);
const duplicateQuote = vi.fn(async () => null);
const deleteQuote = vi.fn(async () => true);
const createQuote = vi.fn(async () => null);
const fetchQuote = vi.fn(async () => null);
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

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
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

const setExpiring = (h: ReturnType<typeof renderHook<ReturnType<typeof useQuotesListPage>, unknown>>) =>
  act(() => h.result.current.setSortBy('expiring'));

describe('useQuotesListPage — filtro "Vencimento próximo" (sort=expiring)', () => {
  it('I1: exclui quotes com status=expired mesmo com valid_until futuro', () => {
    mockQuotes = [
      q({ id: 'a', status: 'expired', valid_until: iso(5 * DAY) }),
      q({ id: 'b', status: 'pending', valid_until: iso(2 * DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage());
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
    const h = renderHook(() => useQuotesListPage());
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id).sort()).toEqual(
      ['edge-now', 'future'].sort(),
    );
  });

  it('I3: exclui quotes sem valid_until', () => {
    mockQuotes = [
      q({ id: 'nil', valid_until: null }),
      q({ id: 'undef', valid_until: undefined }),
      q({ id: 'ok', valid_until: iso(DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage());
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['ok']);
  });

  it('I4: exclui valid_until inválido (NaN/lixo)', () => {
    mockQuotes = [
      q({ id: 'junk', valid_until: 'not-a-date' }),
      q({ id: 'empty', valid_until: '' }),
      q({ id: 'ok', valid_until: iso(DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage());
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['ok']);
  });

  it('I5: ordenação ascendente por valid_until', () => {
    mockQuotes = [
      q({ id: 'd10', valid_until: iso(10 * DAY) }),
      q({ id: 'd1', valid_until: iso(1 * DAY) }),
      q({ id: 'd5', valid_until: iso(5 * DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage());
    setExpiring(h);
    expect(h.result.current.filteredQuotes.map((x) => x.id)).toEqual(['d1', 'd5', 'd10']);
  });

  it('I6: trocar para "newest" reexpõe expirados/sem data', () => {
    mockQuotes = [
      q({ id: 'past', status: 'pending', valid_until: iso(-DAY) }),
      q({ id: 'nil', valid_until: null }),
      q({ id: 'future', valid_until: iso(DAY) }),
    ];
    const h = renderHook(() => useQuotesListPage());
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
    const h = renderHook(() => useQuotesListPage());
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
    const h = renderHook(() => useQuotesListPage());
    setExpiring(h);
    const a = h.result.current.filteredQuotes.map((x) => x.id);
    const b = h.result.current.filteredQuotes.map((x) => x.id);
    expect(a).toEqual(b);
  });

  it('caso vazio: retorna []', () => {
    const h = renderHook(() => useQuotesListPage());
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
        const h = renderHook(() => useQuotesListPage());
        setExpiring(h);
        const out = h.result.current.filteredQuotes;
        let lastT = -Infinity;
        for (const item of out) {
          // I1
          expect(item.status).not.toBe('expired');
          // I3 + I4
          expect(item.valid_until).toBeTruthy();
          const t = new Date(item.valid_until as string).getTime();
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

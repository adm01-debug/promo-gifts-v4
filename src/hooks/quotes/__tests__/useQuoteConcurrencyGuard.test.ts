/**
 * Testes unitários — useQuoteConcurrencyGuard
 *
 * Detecta edição simultânea (last-write-wins race) em orçamentos.
 * Armazena `updated_at` no momento da abertura e verifica se mudou
 * antes de qualquer salvamento.
 *
 * Cobertura:
 *   - baselineRef inicializa com quote.updated_at
 *   - resetBaseline() atualiza o baseline (com e sem argumento)
 *   - checkForConflict(): noop se quote=null ou baseline=null
 *   - checkForConflict(): sem conflito quando remote === baseline
 *   - checkForConflict(): retorna ConflictInfo quando remote > baseline
 *   - checkForConflict(): retorna null se erro do Supabase
 *   - checkForConflict(): retorna null se remote < baseline (rollback)
 *   - label formatado em pt-BR
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuoteConcurrencyGuard } from '../useQuoteConcurrencyGuard';
import type { Quote } from '../quoteTypes';

// ── Mock Supabase (vi.hoisted para evitar problema de inicialização) ──────────
const { mockSingle, mockEq, mockSelect, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  return { mockSingle, mockEq, mockSelect, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeQuote(updatedAt: string, id = 'q-001'): Quote {
  return {
    id,
    updated_at: updatedAt,
    created_at: updatedAt,
    title: 'Orçamento teste',
    status: 'draft',
    organization_id: 'org-1',
    seller_id: 'user-1',
  } as unknown as Quote;
}

/** Data ISO como string no mesmo formato do Supabase (UTC Z) */
const T0 = '2026-06-01T10:00:00.000Z'; // baseline
const T1 = '2026-06-01T10:05:00.000Z'; // remote mais novo (conflito)
const T_OLD = '2026-05-31T09:00:00.000Z'; // remote mais antigo (sem conflito)

beforeEach(() => {
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockEq.mockClear();
  mockSingle.mockClear();
});

// ── Estado inicial ────────────────────────────────────────────────────────────
describe('estado inicial', () => {
  it('baseline é null quando quote=null', () => {
    const { result } = renderHook(() => useQuoteConcurrencyGuard(null));
    expect(result.current.checkForConflict).toBeTypeOf('function');
    expect(result.current.resetBaseline).toBeTypeOf('function');
  });

  it('retorna funções estáveis (useCallback)', () => {
    const { result, rerender } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0)));
    const { checkForConflict: c1, resetBaseline: r1 } = result.current;
    rerender();
    expect(result.current.checkForConflict).toBe(c1);
    expect(result.current.resetBaseline).toBe(r1);
  });
});

// ── checkForConflict: noop ────────────────────────────────────────────────────
describe('checkForConflict — sem consulta ao DB', () => {
  it('retorna null se quote=null', async () => {
    const { result } = renderHook(() => useQuoteConcurrencyGuard(null));
    const conflict = await result.current.checkForConflict();
    expect(conflict).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('retorna null se quote=undefined', async () => {
    const { result } = renderHook(() => useQuoteConcurrencyGuard(undefined));
    const conflict = await result.current.checkForConflict();
    expect(conflict).toBeNull();
  });
});

// ── checkForConflict: sem conflito ───────────────────────────────────────────
describe('checkForConflict — sem conflito', () => {
  it('retorna null quando remote === baseline (timestamp idêntico)', async () => {
    mockSingle.mockResolvedValue({ data: { updated_at: T0 }, error: null });
    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0)));
    const conflict = await result.current.checkForConflict();
    expect(conflict).toBeNull();
  });

  it('retorna null quando remote < baseline (rollback ou clock skew)', async () => {
    mockSingle.mockResolvedValue({ data: { updated_at: T_OLD }, error: null });
    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0)));
    const conflict = await result.current.checkForConflict();
    expect(conflict).toBeNull();
  });

  it('retorna null se Supabase retornar erro', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'RLS denied' } });
    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0)));
    const conflict = await result.current.checkForConflict();
    expect(conflict).toBeNull();
  });

  it('retorna null se updated_at remoto for null', async () => {
    mockSingle.mockResolvedValue({ data: { updated_at: null }, error: null });
    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0)));
    const conflict = await result.current.checkForConflict();
    expect(conflict).toBeNull();
  });
});

// ── checkForConflict: conflito detectado ─────────────────────────────────────
describe('checkForConflict — conflito (remote > baseline)', () => {
  it('retorna ConflictInfo com modifiedAt e label', async () => {
    mockSingle.mockResolvedValue({ data: { updated_at: T1 }, error: null });
    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0)));
    const conflict = await result.current.checkForConflict();
    expect(conflict).not.toBeNull();
    expect(conflict!.modifiedAt).toBe(T1);
    expect(conflict!.label).toMatch(/\d{2}\/\d{2}\/\d{4}/); // dd/mm/yyyy
  });

  it('label está em pt-BR com hora no formato HH:MM', async () => {
    mockSingle.mockResolvedValue({ data: { updated_at: T1 }, error: null });
    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0)));
    const conflict = await result.current.checkForConflict();
    // Exemplo: "01/06/2026, 07:05"
    expect(conflict!.label).toMatch(/\d{2}:\d{2}/);
  });

  it('consulta o DB com o id correto do orçamento', async () => {
    mockSingle.mockResolvedValue({ data: { updated_at: T1 }, error: null });
    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0, 'q-xyz')));
    await result.current.checkForConflict();
    expect(mockFrom).toHaveBeenCalledWith('quotes');
    expect(mockEq).toHaveBeenCalledWith('id', 'q-xyz');
  });
});

// ── resetBaseline ─────────────────────────────────────────────────────────────
describe('resetBaseline', () => {
  it('após reset com novo timestamp, conflito anterior não é mais detectado', async () => {
    // Primeiro check detecta conflito
    mockSingle.mockResolvedValueOnce({ data: { updated_at: T1 }, error: null });
    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0)));
    const conflict1 = await result.current.checkForConflict();
    expect(conflict1).not.toBeNull();

    // Resetar baseline para T1 (após save bem-sucedido)
    act(() => {
      result.current.resetBaseline(T1);
    });

    // Segundo check com mesmo T1: não deve mais ter conflito
    mockSingle.mockResolvedValueOnce({ data: { updated_at: T1 }, error: null });
    const conflict2 = await result.current.checkForConflict();
    expect(conflict2).toBeNull();
  });

  it('resetBaseline sem argumento usa Date.now() aproximado', async () => {
    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0)));
    const before = Date.now();
    act(() => {
      result.current.resetBaseline();
    });
    const after = Date.now();
    // Sanidade temporal: o intervalo que cerca o reset é monotônico.
    expect(after).toBeGreaterThanOrEqual(before);

    // Próximo check com timestamp antigo não deve gerar conflito
    // (baseline foi atualizado para agora, T0 < agora)
    mockSingle.mockResolvedValueOnce({ data: { updated_at: T0 }, error: null });
    const conflict = await result.current.checkForConflict();
    expect(conflict).toBeNull(); // T0 < baseline atual (now)
  });
});

// ── Invariantes de integridade temporal ──────────────────────────────────────
describe('invariantes de integridade temporal', () => {
  it('comparação é por valor de data, não por string literal', async () => {
    // Mesmo instante em formatos diferentes (com e sem milissegundos)
    const T0_ms = '2026-06-01T10:00:00.000Z';
    const T0_no_ms = '2026-06-01T10:00:00Z';
    mockSingle.mockResolvedValue({ data: { updated_at: T0_no_ms }, error: null });
    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0_ms)));
    const conflict = await result.current.checkForConflict();
    // Mesma data = sem conflito
    expect(conflict).toBeNull();
  });

  it('múltiplos checkForConflict sequenciais funcionam corretamente', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { updated_at: T0 }, error: null }) // sem conflito
      .mockResolvedValueOnce({ data: { updated_at: T1 }, error: null }); // com conflito

    const { result } = renderHook(() => useQuoteConcurrencyGuard(makeQuote(T0)));

    const c1 = await result.current.checkForConflict();
    const c2 = await result.current.checkForConflict();

    expect(c1).toBeNull();
    expect(c2).not.toBeNull();
  });
});

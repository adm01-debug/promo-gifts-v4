/**
 * Testes do REST nativo — traps de vazio silencioso A1 + A2 (PR draft).
 *
 * Cobre:
 *  - A1: _search em tabela whitelisted SEM coluna de busca → serve query base (sem ilike, sem 400).
 *  - A2: filtro array VAZIO → short-circuit { records: [], count: 0 } sem ir à rede.
 *  - F2: _search vazio/whitespace/não-string → "sem busca" (não derruba a query, sem ilike).
 *  - F3: _search:[] é removido ANTES do scan de array vazio (não vira short-circuit).
 *  - F4: A2 tem precedência sobre _search.
 *  - Regressão: _search em 'products' continua aplicando ilike('name', '%termo%').
 *  - Elegibilidade: whitelisted é elegível com/sem coluna de busca; não-whitelisted é inelegível.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks das dependências de módulo (hoisted p/ vi.mock poder referenciá-los).
const { fromMock, loggerMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  loggerMock: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: fromMock } }));
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));
vi.mock('./silent-empty-report', () => ({ reportSilentEmpty: vi.fn() }));
vi.mock('@/lib/telemetry/bridgeCallMetrics', () => ({
  recordBridgeCall: vi.fn(),
  estimatePayloadBytes: vi.fn(() => 0),
}));
vi.mock('@/lib/telemetry/requestId', () => ({ newRequestId: vi.fn(() => 'req-test') }));

import { isRestNativeEligible, executeRestNativeSelect } from './rest-native';

type CannedResult = {
  data: unknown[] | null;
  error: { message: string } | null;
  count: number | null;
};

/** Cria um stub encadeável que registra cada chamada e resolve para `result`. */
function makeQueryStub(result: CannedResult) {
  const calls: Record<string, unknown[][]> = {};
  const stub: Record<string, unknown> = {};
  const record = (name: string, args: unknown[]) => {
    (calls[name] ||= []).push(args);
    return stub;
  };
  for (const m of [
    'select',
    'eq',
    'in',
    'is',
    'gte',
    'lte',
    'gt',
    'lt',
    'like',
    'ilike',
    'neq',
    'not',
    'order',
    'range',
  ]) {
    stub[m] = (...args: unknown[]) => record(m, args);
  }
  // Thenable: `await query` resolve para o resultado canônico.
  stub.then = (resolve: (v: CannedResult) => unknown) => Promise.resolve(result).then(resolve);
  stub.__calls = calls;
  return stub as Record<string, (...a: unknown[]) => unknown> & {
    __calls: Record<string, unknown[][]>;
  };
}

beforeEach(() => {
  fromMock.mockReset();
  loggerMock.warn.mockReset();
  loggerMock.debug.mockReset();
});

describe('isRestNativeEligible', () => {
  it('whitelisted COM coluna de busca → elegível mesmo com _search', () => {
    expect(
      isRestNativeEligible({ table: 'products', operation: 'select', filters: { _search: 'x' } }),
    ).toBe(true);
  });

  it('A1: whitelisted SEM coluna de busca → continua elegível com _search', () => {
    expect(
      isRestNativeEligible({
        table: 'product_images',
        operation: 'select',
        filters: { _search: 'x' },
      }),
    ).toBe(true);
  });

  it('não-whitelisted → inelegível', () => {
    expect(isRestNativeEligible({ table: 'orders', operation: 'select' })).toBe(false);
  });

  it('operação de escrita → inelegível', () => {
    expect(isRestNativeEligible({ table: 'products', operation: 'insert' })).toBe(false);
  });
});

describe('executeRestNativeSelect — _search (A1 / F2 / regressão)', () => {
  it('regressão: _search em products aplica ilike(name)', async () => {
    const stub = makeQueryStub({ data: [{ id: '1', name: 'X' }], error: null, count: null });
    fromMock.mockReturnValue(stub);
    const res = await executeRestNativeSelect({
      table: 'products',
      operation: 'select',
      filters: { _search: 'abc' },
    });
    expect(fromMock).toHaveBeenCalledWith('v_products_public'); // alias aplicado
    expect(stub.__calls.ilike?.[0]).toEqual(['name', '%abc%']);
    expect(res.records).toHaveLength(1);
  });

  it('A1: _search em product_images NÃO aplica ilike e serve filtros base', async () => {
    const stub = makeQueryStub({ data: [{ id: 'i1' }], error: null, count: null });
    fromMock.mockReturnValue(stub);
    await executeRestNativeSelect({
      table: 'product_images',
      operation: 'select',
      filters: { _search: 'abc', product_id: 'p1' },
    });
    expect(fromMock).toHaveBeenCalledWith('product_images');
    expect(stub.__calls.ilike).toBeUndefined(); // sem ilike → sem 400
    expect(stub.__calls.eq?.[0]).toEqual(['product_id', 'p1']); // filtro base aplicado
    expect(loggerMock.warn).toHaveBeenCalledTimes(1); // diagnóstico visível
  });

  it('F2: _search só-whitespace em products → sem ilike, query roda', async () => {
    const stub = makeQueryStub({ data: [], error: null, count: null });
    fromMock.mockReturnValue(stub);
    await executeRestNativeSelect({
      table: 'products',
      operation: 'select',
      filters: { _search: '   ' },
    });
    expect(stub.__calls.ilike).toBeUndefined();
    expect(fromMock).toHaveBeenCalled();
  });

  it('F2: _search não-string em products → sem ilike, query roda', async () => {
    const stub = makeQueryStub({ data: [], error: null, count: null });
    fromMock.mockReturnValue(stub);
    await executeRestNativeSelect({
      table: 'products',
      operation: 'select',
      filters: { _search: 42 as unknown as string },
    });
    expect(stub.__calls.ilike).toBeUndefined();
    expect(fromMock).toHaveBeenCalled();
  });
});

describe('executeRestNativeSelect — array vazio (A2 / F3 / F4)', () => {
  it('A2: filtro array vazio → short-circuit { [], 0 } SEM rede', async () => {
    await expect(
      executeRestNativeSelect({
        table: 'products',
        operation: 'select',
        filters: { category_id: [] },
      }),
    ).resolves.toEqual({ records: [], count: 0 });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('A2: array vazio em coluna uuid (id) → short-circuit, nunca 400', async () => {
    await expect(
      executeRestNativeSelect({
        table: 'product_variants',
        operation: 'select',
        filters: { id: [] },
      }),
    ).resolves.toEqual({ records: [], count: 0 });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('F4: A2 tem precedência sobre _search (array vazio + _search) → { [], 0 }', async () => {
    const res = await executeRestNativeSelect({
      table: 'products',
      operation: 'select',
      filters: { _search: 'abc', category_id: [] },
    });
    expect(res).toEqual({ records: [], count: 0 });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('F3: _search:[] é removido antes do scan → NÃO vira short-circuit de array vazio', async () => {
    const stub = makeQueryStub({ data: [{ id: '1' }], error: null, count: null });
    fromMock.mockReturnValue(stub);
    const res = await executeRestNativeSelect({
      table: 'products',
      operation: 'select',
      filters: { _search: [] as unknown as string },
    });
    expect(fromMock).toHaveBeenCalled(); // query roda (não houve short-circuit)
    expect(stub.__calls.ilike).toBeUndefined(); // _search:[] não é string → sem ilike
    expect(res.records).toHaveLength(1);
  });

  it('array NÃO-vazio continua virando filtro .in()', async () => {
    const stub = makeQueryStub({ data: [], error: null, count: null });
    fromMock.mockReturnValue(stub);
    await executeRestNativeSelect({
      table: 'products',
      operation: 'select',
      filters: { category_id: ['a', 'b'] },
    });
    expect(fromMock).toHaveBeenCalled();
    expect(stub.__calls.in?.[0]).toEqual(['category_id', ['a', 'b']]);
  });
});

describe('executeRestNativeSelect — not.* filters (parsePostgrestString)', () => {
  it('not.eq: chama query.not(col, "eq", val)', async () => {
    const stub = makeQueryStub({ data: [], error: null, count: null });
    fromMock.mockReturnValue(stub);
    await executeRestNativeSelect({
      table: 'products',
      operation: 'select',
      filters: { status: 'not.eq.inactive' },
    });
    expect(stub.__calls.not?.[0]).toEqual(['status', 'eq', 'inactive']);
  });

  it('not.in: chama query.not(col, "in", "(a,b,c)")', async () => {
    const stub = makeQueryStub({ data: [], error: null, count: null });
    fromMock.mockReturnValue(stub);
    await executeRestNativeSelect({
      table: 'products',
      operation: 'select',
      filters: { category_id: 'not.in.(a,b,c)' },
    });
    expect(stub.__calls.not?.[0]).toEqual(['category_id', 'in', '(a,b,c)']);
  });
});

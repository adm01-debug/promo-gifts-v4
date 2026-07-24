import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => {
  const mockInvoke = vi.fn();
  return {
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
    },
    __mockInvoke: mockInvoke,
  };
});

import { __mockInvoke as mockInvoke } from '@/integrations/supabase/client';
import { invokeWithRetry, extractFunctionErrorMessage } from '@/lib/external-db/invoke';

describe('extractFunctionErrorMessage', () => {
  it('returns message from Error instance', async () => {
    const err = new Error('Something failed');
    expect(await extractFunctionErrorMessage(err)).toBe('Something failed');
  });

  it('returns generic message for non-Error', async () => {
    expect(await extractFunctionErrorMessage('string error')).toBe('Erro ao acessar banco externo');
    expect(await extractFunctionErrorMessage(null)).toBe('Erro ao acessar banco externo');
  });

  it('extracts detailed message from Response context', async () => {
    const responseBody = JSON.stringify({ error: 'DB error', details: 'column missing', hint: 'check schema' });
    const mockResponse = new Response(responseBody, { status: 500 });
    const err = new Error('FunctionsHttpError') as Error & { context: Response };
    err.context = mockResponse;

    const result = await extractFunctionErrorMessage(err);
    expect(result).toContain('DB error');
    expect(result).toContain('column missing');
    expect(result).toContain('check schema');
  });
});

describe('invokeWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data on first success', async () => {
    (mockInvoke as any).mockResolvedValueOnce({ data: { records: [{ id: '1' }] }, error: null });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' });
    expect(result.data).toEqual({ records: [{ id: '1' }] });
    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const retryableError = new Error('503 bad gateway');
    (mockInvoke as any)
      .mockResolvedValueOnce({ data: null, error: retryableError })
      .mockResolvedValueOnce({ data: { records: [] }, error: null });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 2);
    expect(result.data).toEqual({ records: [] });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-retryable error', async () => {
    const nonRetryableError = new Error('Invalid column "xyz"');
    (mockInvoke as any).mockResolvedValueOnce({ data: null, error: nonRetryableError });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 3);
    expect(result.error).toBe(nonRetryableError);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries and returns error', async () => {
    const retryableError = new Error('Failed to fetch');
    (mockInvoke as any).mockResolvedValue({ data: null, error: retryableError });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 1);
    expect(result.error).toBe(retryableError);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('fails fast on deterministic schema error (does not exist)', async () => {
    const schemaError = new Error('column products.price_updated_at does not exist');
    (mockInvoke as any).mockResolvedValue({ data: null, error: schemaError });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 3);
    expect(result.error).toBe(schemaError);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('fails fast on invalid input syntax', async () => {
    const validationError = new Error('invalid input syntax for type timestamp');
    (mockInvoke as any).mockResolvedValue({ data: null, error: validationError });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 3);
    expect(result.error).toBe(validationError);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('retries on SUPABASE_EDGE_RUNTIME_ERROR cold-start (503) and succeeds', async () => {
    const responseBody = JSON.stringify({
      code: 'SUPABASE_EDGE_RUNTIME_ERROR',
      message: 'Service is temporarily unavailable',
    });
    const coldStartError = new Error('Edge function returned 503: Error') as Error & { context: Response };
    coldStartError.context = new Response(responseBody, { status: 503 });

    (mockInvoke as any)
      .mockResolvedValueOnce({ data: null, error: coldStartError })
      .mockResolvedValueOnce({ data: { records: [{ id: '1' }] }, error: null });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 2);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ records: [{ id: '1' }] });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });
});

describe('invokeWithRetry — classifier edge cases (HTTP word-boundary regex)', () => {
  beforeEach(() => {
    (mockInvoke as any).mockReset();
  });

  it('UUID com "400" no meio NÃO é tratado como HTTP 400 (sem falso positivo)', async () => {
    // Antes da regex de borda, "row 400e1234..." casava com '400' literal e abortava.
    // Agora deve seguir o fluxo normal: como não casa retryable nem non-retryable, retorna sem retry.
    const err = new Error('row 400e1234-aaaa-bbbb-cccc-1234567890ab not found');
    (mockInvoke as any).mockResolvedValueOnce({ data: null, error: err });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 3);
    expect(result.error).toBe(err);
    // Não deve ter feito retry (não é retryable), mas também não deve estar sendo
    // classificado como non-retryable por falso positivo — então 1 invoke só.
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('IDs com hífen ao redor de dígitos (ex: "abc-401-xyz") NÃO disparam HTTP 401 falso', async () => {
    // Hífen conta como word boundary, mas a regex agora exige prefixo explícito
    // (returned/status/http) → ids/UUIDs/slugs com 400/401/403 não casam mais.
    const err = new Error('lookup failed for abc-401-xyz token');
    (mockInvoke as any).mockResolvedValueOnce({ data: null, error: err });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 3);
    expect(result.error).toBe(err);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('HTTP 400 real (Edge function returned 400) → fail-fast', async () => {
    const err = new Error('Edge function returned 400: Bad Request');
    (mockInvoke as any).mockResolvedValueOnce({ data: null, error: err });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 3);
    expect(result.error).toBe(err);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('HTTP 401 com prefixo "status:" → fail-fast', async () => {
    const err = new Error('status: 401 unauthorized token');
    (mockInvoke as any).mockResolvedValueOnce({ data: null, error: err });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 3);
    expect(result.error).toBe(err);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('HTTP 403 com prefixo "http/" → fail-fast', async () => {
    const err = new Error('http/403 forbidden by RLS');
    (mockInvoke as any).mockResolvedValueOnce({ data: null, error: err });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 3);
    expect(result.error).toBe(err);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('"503" sempre vence acidentes (mesmo com "unauthorized" na mensagem)', async () => {
    // Cenário paranoico: provider retorna 503 com texto que casaria non-retryable.
    // Regra explícita: 503 é sempre retentável.
    const err = new Error('503 unauthorized upstream');
    (mockInvoke as any)
      .mockResolvedValueOnce({ data: null, error: err })
      .mockResolvedValueOnce({ data: { records: [] }, error: null });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 2);
    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('"service is temporarily unavailable" sem código HTTP é retentável', async () => {
    const err = new Error('Service is temporarily unavailable');
    (mockInvoke as any)
      .mockResolvedValueOnce({ data: null, error: err })
      .mockResolvedValueOnce({ data: { records: [] }, error: null });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 2);
    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('boot_error é retentável (cold-start)', async () => {
    const err = new Error('boot_error: function failed to start');
    (mockInvoke as any)
      .mockResolvedValueOnce({ data: null, error: err })
      .mockResolvedValueOnce({ data: { records: [] }, error: null });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 2);
    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('JWT expired → fail-fast (deterministic auth error)', async () => {
    const err = new Error('JWT expired, please re-authenticate');
    (mockInvoke as any).mockResolvedValueOnce({ data: null, error: err });

    const result = await invokeWithRetry({ table: 'products', operation: 'select' }, 3);
    expect(result.error).toBe(err);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});


describe('invokeWithRetry — latência/timeout e retry controlado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('propaga erro de timeout após esgotar retry e executa tentativas controladas', async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const timeoutErr = new Error('AbortError: timeout after 25000ms');
    (mockInvoke as any).mockResolvedValue({ data: null, error: timeoutErr });

    const onRetry = vi.fn();
    const promise = invokeWithRetry({ table: 'products', operation: 'select' }, 2, onRetry);

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toBe(timeoutErr);
    expect(mockInvoke).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, 2, 800);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, 2, 1600);

    randomSpy.mockRestore();
    vi.useRealTimers();
  });

  it('retry não duplica efeito colateral do payload (mesmo objeto de body em todas as tentativas)', async () => {
    const sideEffects: string[] = [];
    const payload = {
      table: 'products',
      operation: 'select',
      marker: {
        register: () => sideEffects.push('effect'),
      },
    };

    const transientErr = new Error('503 bad gateway');
    (mockInvoke as any)
      .mockResolvedValueOnce({ data: null, error: transientErr })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const result = await invokeWithRetry(payload, 2);

    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    const [firstCall, secondCall] = (mockInvoke as any).mock.calls;
    expect(firstCall[1].body).toBe(payload);
    expect(secondCall[1].body).toBe(payload);
    expect(sideEffects).toEqual([]);
  });
});

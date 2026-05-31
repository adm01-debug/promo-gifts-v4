import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } } }),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { invokeBridge, invokeExternalDb, invokeExternalDbDelete, invokeBatchBridge } from '@/lib/external-db/bridge';
import { supabase } from '@/integrations/supabase/client';

const mockInvoke = vi.mocked(supabase.functions.invoke);

describe('invokeBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if table is missing for non-batch operations', async () => {
    await expect(
      invokeBridge({ operation: 'select' })
    ).rejects.toThrow('tabela nao informada');
  });

  it('allows batch operations without table', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, data: { results: [{ success: true, data: { records: [], count: 0 } }] } },
      error: null,
    });

    const result = await invokeBridge({ operation: 'batch', queries: [] });
    expect(result.success).toBe(true);
  });

  it('retries on boot errors', async () => {
    // First call fails with 502
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Bad Gateway', context: { status: 502 } },
    });
    // Second call succeeds
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, data: { records: [], count: 0 } },
      error: null,
    });

    const result = await invokeBridge({ table: 'products', operation: 'select' });
    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries', async () => {
    const errorResponse = {
      data: null,
      error: { message: 'function failed to start' },
    };
    mockInvoke.mockResolvedValue(errorResponse);

    await expect(
      invokeBridge({ table: 'products', operation: 'select' })
    ).rejects.toThrow('Erro na bridge');
    expect(mockInvoke).toHaveBeenCalledTimes(4); // BOOT_RETRY_ATTEMPTS=4
  });

  it('throws on non-retryable errors immediately', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Invalid request' },
    });

    await expect(
      invokeBridge({ table: 'products', operation: 'select' })
    ).rejects.toThrow('Erro na bridge');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('throws on success:false response', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'Tabela não encontrada' },
      error: null,
    });

    await expect(
      invokeBridge({ table: 'nonexistent', operation: 'select' })
    ).rejects.toThrow('Tabela não encontrada');
  });
});

describe('invokeExternalDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps single non-record responses for mutations', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, data: { id: 'new-1', name: 'Test' } },
      error: null,
    });

    const result = await invokeExternalDb({
      table: 'audit_logs',
      operation: 'insert',
      data: { name: 'Test' },
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toEqual({ id: 'new-1', name: 'Test' });
    expect(result.count).toBe(1);
  });

  it('passes through records array for select', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, data: { records: [{ id: '1' }, { id: '2' }], count: 2 } },
      error: null,
    });

    const result = await invokeExternalDb({
      table: 'audit_logs',
      operation: 'select',
    });

    expect(result.records).toHaveLength(2);
    expect(result.count).toBe(2);
  });
});

describe('invokeExternalDbDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls bridge with delete operation', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, data: { deleted_id: 'del-1' } },
      error: null,
    });

    await invokeExternalDbDelete('audit_logs', 'del-1');
    expect(mockInvoke).toHaveBeenCalledWith('external-db-bridge', {
      body: { table: 'audit_logs', operation: 'delete', id: 'del-1' },
      headers: { Authorization: 'Bearer mock-token' },
    });
  });
});

describe('invokeBatchBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends all queries in single call when under limit', async () => {
    const queries = Array.from({ length: 5 }, (_, i) => ({
      table: `table_${i}`,
      operation: 'select' as const,
    }));

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        data: {
          results: queries.map(() => ({
            success: true,
            data: { records: [], count: 0 },
          })),
        },
      },
      error: null,
    });

    const results = await invokeBatchBridge(queries);
    expect(results).toHaveLength(5);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('chunks queries exceeding batch limit', async () => {
    const queries = Array.from({ length: 15 }, (_, i) => ({
      table: `table_${i}`,
      operation: 'select' as const,
    }));

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        data: {
          results: Array.from({ length: 10 }, () => ({
            success: true,
            data: { records: [], count: 0 },
          })),
        },
      },
      error: null,
    });

    // Will need 2 calls: 10 + 5
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          results: Array.from({ length: 10 }, () => ({
            success: true,
            data: { records: [], count: 0 },
          })),
        },
      },
      error: null,
    });
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          results: Array.from({ length: 5 }, () => ({
            success: true,
            data: { records: [], count: 0 },
          })),
        },
      },
      error: null,
    });

    const results = await invokeBatchBridge(queries);
    expect(results).toHaveLength(15);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } } }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Etapa 4: bridge routing is tested in isolation from the PostgREST write
// mechanics. executeRestNativeWrite is exercised end-to-end in
// rest-native-write.test.ts; here we only assert that invokeExternalDb /
// invokeExternalDbDelete ROUTE writes/deletes to it for whitelisted tables.
vi.mock('@/lib/external-db/rest-native-write', () => {
  const WRITABLE = new Set([
    'products', 'suppliers', 'product_variants', 'product_images', 'product_videos',
    'product_kit_components', 'product_materials', 'print_area_techniques',
    'tabela_preco_gravacao_oficial', 'tabela_preco_gravacao_oficial_faixa', 'tecnicas_gravacao',
    'tecnica_gravacao', 'customization_price_tiers', 'personalization_techniques',
  ]);
  return {
    isRestNativeWriteEligible: vi.fn((t: string) => WRITABLE.has(t)),
    executeRestNativeWrite: vi.fn(async () => ({ records: [{ id: 'new-1', name: 'Test' }], count: 1 })),
  };
});

import { invokeBridge, invokeExternalDb, invokeExternalDbDelete, invokeBatchBridge } from '@/lib/external-db/bridge';
import { supabase } from '@/integrations/supabase/client';
import { executeRestNativeWrite } from '@/lib/external-db/rest-native-write';

const mockInvoke = vi.mocked(supabase.functions.invoke);
const mockWrite = vi.mocked(executeRestNativeWrite);

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
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Bad Gateway', context: { status: 502 } },
    });
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
      data: { success: false, error: 'Tabela nao encontrada' },
      error: null,
    });

    await expect(
      invokeBridge({ table: 'nonexistent', operation: 'select' })
    ).rejects.toThrow('Tabela nao encontrada');
  });
});

describe('invokeExternalDb — write routing (Etapa 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes eligible mutations to the REST-native write path (not the bridge)', async () => {
    const result = await invokeExternalDb({
      table: 'products',
      operation: 'insert',
      data: { name: 'Test' },
    });

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toEqual({ id: 'new-1', name: 'Test' });
    expect(result.count).toBe(1);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('propagates write errors loudly (no silent no-op)', async () => {
    mockWrite.mockRejectedValueOnce(new Error('new row violates row-level security policy'));
    await expect(
      invokeExternalDb({ table: 'products', operation: 'update', id: 'p1', data: { name: 'x' } })
    ).rejects.toThrow('row-level security');
  });

  it('passes through records array for select (REST native, bridge fallback)', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, data: { records: [{ id: '1' }, { id: '2' }], count: 2 } },
      error: null,
    });

    const result = await invokeExternalDb({
      table: 'products',
      operation: 'select',
    });

    expect(result.records).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(mockWrite).not.toHaveBeenCalled();
  });
});

describe('invokeExternalDbDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes delete to the REST-native write path for whitelisted tables', async () => {
    await invokeExternalDbDelete('products', 'del-1');
    expect(mockWrite).toHaveBeenCalledWith({ table: 'products', operation: 'delete', id: 'del-1' });
    expect(mockInvoke).not.toHaveBeenCalled();
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

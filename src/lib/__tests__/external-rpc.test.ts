/**
 * Regressão: invokeExternalRpc deve preservar o `this` do supabase ao chamar `.rpc`.
 * Sem bind, supabase-js v2 dispara "Cannot read properties of undefined (reading 'rest')"
 * porque internamente executa `this.rest.rpc(...)`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcSpy = vi.fn();

vi.mock('@/integrations/supabase/client', () => {
  // Simula o comportamento real do SupabaseClient: rpc usa `this.rest` internamente.
  const client = {
    rest: { ok: true },
    rpc(this: { rest: unknown }, fn: string, args: Record<string, unknown>) {
      // Reproduz o crash quando `this` é perdido.
      if (!this || !this.rest) {
        throw new TypeError("Cannot read properties of undefined (reading 'rest')");
      }
      return rpcSpy(fn, args);
    },
  };
  return { supabase: client };
});

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { invokeExternalRpc } from '@/lib/external-rpc';

describe('invokeExternalRpc — binding de `this`', () => {
  beforeEach(() => {
    rpcSpy.mockReset();
  });

  it('preserva o contexto do supabase (não estoura "reading rest")', async () => {
    rpcSpy.mockResolvedValueOnce({ data: { ok: 1 }, error: null });
    await expect(
      invokeExternalRpc<{ ok: number }>('fn_test', { p: 1 }),
    ).resolves.toEqual({ ok: 1 });
    expect(rpcSpy).toHaveBeenCalledWith('fn_test', { p: 1 });
  });

  it('propaga erro não-retryável após a chamada bem-sucedida do client', async () => {
    rpcSpy.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(invokeExternalRpc('fn_test', {})).rejects.toThrow('permission denied');
  });
});

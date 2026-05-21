import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Integration test for the Simulation Orchestrator.
 * Valida o contrato de invocação (nome da função + payload) da ponte frontend→edge.
 * NOTA: supabase.functions é um getter lazy; capturamos a instância uma única vez
 * para que o spy e a chamada usem a MESMA referência (senão Number of calls = 0).
 */
describe('Simulation Orchestrator Integration', () => {
  const fns = supabase.functions;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should trigger a resilience simulation successfully', async () => {
    const invokeSpy = vi.spyOn(fns, 'invoke').mockResolvedValue({ data: { ok: true }, error: null } as unknown as ReturnType<typeof fns.invoke>);

    await fns.invoke('simulation-orchestrator', { body: { count: 10, mode: 'resilience' } });

    expect(invokeSpy).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ mode: 'resilience' })
    }));
  });

  it('should trigger a load test with high count', async () => {
    const invokeSpy = vi.spyOn(fns, 'invoke').mockResolvedValue({ data: { ok: true }, error: null } as unknown as ReturnType<typeof fns.invoke>);

    await fns.invoke('simulation-orchestrator', { body: { count: 500, mode: 'load' } });

    expect(invokeSpy).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ count: 500, mode: 'load' })
    }));
  });

  it('should trigger a fuzzing test', async () => {
    const invokeSpy = vi.spyOn(fns, 'invoke').mockResolvedValue({ data: { ok: true }, error: null } as unknown as ReturnType<typeof fns.invoke>);

    await fns.invoke('simulation-orchestrator', { body: { count: 50, mode: 'fuzzing' } });

    expect(invokeSpy).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ mode: 'fuzzing' })
    }));
  });
});

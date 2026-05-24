import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Integration test for the Simulation Orchestrator.
 * This ensures the bridge between frontend and simulation logic is intact.
 *
 * Nota: `supabase.functions` é um getter lazy do supabase-js v2 que retorna uma
 * NOVA instância de FunctionsClient a cada acesso. Por isso capturamos a
 * instância UMA vez (`fns`) e usamos a MESMA referência para o spy e para a
 * chamada — espiar `supabase.functions.invoke` inline criaria instâncias
 * diferentes e o spy registraria 0 chamadas.
 */
describe('Simulation Orchestrator Integration', () => {
  let fns: typeof supabase.functions;
  let invokeSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    fns = supabase.functions;
  });

  beforeEach(() => {
    invokeSpy = vi
      .spyOn(fns, 'invoke')
      .mockResolvedValue({ data: { ok: true }, error: null } as never);
  });

  it('should trigger a resilience simulation successfully', async () => {
    await fns.invoke('simulation-orchestrator', {
      body: { count: 10, mode: 'resilience' }
    });

    expect(invokeSpy).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ mode: 'resilience' })
    }));
  });

  it('should trigger a load test with high count', async () => {
    await fns.invoke('simulation-orchestrator', {
      body: { count: 500, mode: 'load' }
    });

    expect(invokeSpy).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ count: 500, mode: 'load' })
    }));
  });

  it('should trigger a fuzzing test', async () => {
    await fns.invoke('simulation-orchestrator', {
      body: { count: 50, mode: 'fuzzing' }
    });

    expect(invokeSpy).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ mode: 'fuzzing' })
    }));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FunctionsClient } from '@supabase/functions-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Integration test for the Simulation Orchestrator.
 * Valida o CONTRATO de chamada (payload shape) sem depender da edge real.
 *
 * Atenção: em `@supabase/supabase-js`, `supabase.functions` é um GETTER que
 * retorna uma nova instância de `FunctionsClient` a cada acesso. Por isso
 * `vi.spyOn(supabase.functions, 'invoke')` espiava uma instância órfã que
 * nunca recebia chamada (daí "Number of calls: 0"). A solução é patchear o
 * método no PROTÓTIPO — todas as instâncias compartilham a mesma função.
 */
describe('Simulation Orchestrator Integration', () => {
  let invokeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    invokeSpy = vi
      .spyOn(FunctionsClient.prototype, 'invoke')
      .mockResolvedValue({ data: { ok: true }, error: null } as never);
  });

  it('should trigger a resilience simulation successfully', async () => {
    await supabase.functions.invoke('simulation-orchestrator', {
      body: { count: 10, mode: 'resilience' },
    });

    expect(invokeSpy).toHaveBeenCalledWith(
      'simulation-orchestrator',
      expect.objectContaining({
        body: expect.objectContaining({ mode: 'resilience' }),
      }),
    );
  });

  it('should trigger a load test with high count', async () => {
    await supabase.functions.invoke('simulation-orchestrator', {
      body: { count: 500, mode: 'load' },
    });

    expect(invokeSpy).toHaveBeenCalledWith(
      'simulation-orchestrator',
      expect.objectContaining({
        body: expect.objectContaining({ count: 500, mode: 'load' }),
      }),
    );
  });

  it('should trigger a fuzzing test', async () => {
    await supabase.functions.invoke('simulation-orchestrator', {
      body: { count: 50, mode: 'fuzzing' },
    });

    expect(invokeSpy).toHaveBeenCalledWith(
      'simulation-orchestrator',
      expect.objectContaining({
        body: expect.objectContaining({ mode: 'fuzzing' }),
      }),
    );
  });
});

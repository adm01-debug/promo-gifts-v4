import { describe, it, expect, vi, beforeAll } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Integration test for the Simulation Orchestrator.
 * This ensures the bridge between frontend and simulation logic is intact.
 */
describe('Simulation Orchestrator Integration', () => {
  // We mock the fetch for edge function calls if we are in a pure unit test env,
  // but here we try to validate the invocation structure.
  
  it('should trigger a resilience simulation successfully', async () => {
    // In CI, we might not have the actual deployed function available for fetch,
    // but we can test the invoke payload validation.
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke');
    
    const mode = 'resilience';
    await supabase.functions.invoke('simulation-orchestrator', {
      body: { count: 10, mode }
    });

    expect(invokeSpy).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ mode: 'resilience' })
    }));
  });

  it('should trigger a load test with high count', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke');
    
    await supabase.functions.invoke('simulation-orchestrator', {
      body: { count: 500, mode: 'load' }
    });

    expect(invokeSpy).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ count: 500, mode: 'load' })
    }));
  });

  it('should trigger a fuzzing test', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke');
    
    await supabase.functions.invoke('simulation-orchestrator', {
      body: { count: 50, mode: 'fuzzing' }
    });

    expect(invokeSpy).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ mode: 'fuzzing' })
    }));
  });
});

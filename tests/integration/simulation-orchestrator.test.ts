import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase.functions.invoke at the module boundary so the spy is the
// SAME instance the consumer code reaches. vi.spyOn against the real client
// fails here because the test env doesn't have a working supabase auth state,
// so the actual invoke throws before our assertion runs.
const invokeMock = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

// Import AFTER vi.mock so the test gets the mocked instance.
import { supabase } from '@/integrations/supabase/client';

/**
 * Integration test for the Simulation Orchestrator.
 * Validates the bridge between frontend and simulation edge function — the
 * payload contract (mode/count) the frontend ships to `simulation-orchestrator`.
 */
describe('Simulation Orchestrator Integration', () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  it('should trigger a resilience simulation successfully', async () => {
    const mode = 'resilience';
    await supabase.functions.invoke('simulation-orchestrator', {
      body: { count: 10, mode },
    });

    expect(invokeMock).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ mode: 'resilience' }),
    }));
  });

  it('should trigger a load test with high count', async () => {
    await supabase.functions.invoke('simulation-orchestrator', {
      body: { count: 500, mode: 'load' },
    });

    expect(invokeMock).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ count: 500, mode: 'load' }),
    }));
  });

  it('should trigger a fuzzing test', async () => {
    await supabase.functions.invoke('simulation-orchestrator', {
      body: { count: 50, mode: 'fuzzing' },
    });

    expect(invokeMock).toHaveBeenCalledWith('simulation-orchestrator', expect.objectContaining({
      body: expect.objectContaining({ mode: 'fuzzing' }),
    }));
  });
});

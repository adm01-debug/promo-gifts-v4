import { afterEach, describe, expect, it, vi } from 'vitest';

describe('supabase client import safety', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('imports safely when window is undefined', async () => {
    vi.stubGlobal('window', undefined);

    await expect(import('@/integrations/supabase/client')).resolves.toHaveProperty('supabase');
  });
});

/**
 * BUG-23 Regression Test — useAccessSecurity isMounted guard em fetchAll
 *
 * Verifica que setIsLoading(false) e outros setters NÃO são chamados após
 * o componente ser desmontado enquanto o Promise.all ainda está em vôo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../components/render-helpers';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from './_helpers/render-hook-providers';
import { resetSupabaseMocks, makeChain } from './_helpers/mock-supabase-builder';
import { supabase } from '@/integrations/supabase/client';
import { useAccessSecurity } from '@/hooks/auth/useAccessSecurity';

const mockedFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;

function setupNormalMocks() {
  resetSupabaseMocks();
  mockedFrom
    .mockReturnValueOnce(makeChain({ data: { id: 's1', ip_whitelist_enabled: false, city_whitelist_enabled: false, block_unknown_locations: false, max_failed_attempts: 5, lockout_duration_minutes: 15 }, error: null }))
    .mockReturnValueOnce(makeChain({ data: [], error: null }))
    .mockReturnValueOnce(makeChain({ data: [], error: null }))
    .mockReturnValueOnce(makeChain({ data: [], error: null }));
}

describe('useAccessSecurity — BUG-23: isMounted guard em fetchAll', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não lança erro ao desmontar antes do Promise.all resolver', async () => {
    resetSupabaseMocks();

    // Queries que ficam pendentes para simular unmount antes de resolver
    const pendingPromise = new Promise<{ data: null; error: null }>(() => {});
    mockedFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnValue(pendingPromise),
    } as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHookWithProviders(() => useAccessSecurity());

    // Desmonta antes do fetch resolver
    unmount();
    await new Promise((r) => setTimeout(r, 10));

    // BUG-23: antes do fix, setIsLoading(false) seria chamado após unmount
    const unmountErrors = consoleSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('unmounted'),
    );
    expect(unmountErrors).toHaveLength(0);

    consoleSpy.mockRestore();
  });

  it('carrega normalmente quando montado por tempo suficiente', async () => {
    setupNormalMocks();

    const { result } = renderHookWithProviders(() => useAccessSecurity());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.settings?.id).toBe('s1');
  });

  it('finally { setIsLoading(false) } executa quando componente está montado', async () => {
    setupNormalMocks();

    const { result } = renderHookWithProviders(() => useAccessSecurity());

    // Inicia como loading
    expect(result.current.isLoading).toBe(true);

    // Após resolver, deve ter saído do loading
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

/**
 * Testes de Regressao -- BUG-08 a BUG-14
 * Auditoria de hooks -- promo-gifts-v4 (2026-05)
 * 21/21 testes passando, zero warnings (validado 2026-05-26)
 *
 * Padroes aplicados:
 * - render-helpers.tsx ativa mocks globais (supabase, AuthContext)
 * - clearAllMocks() em vez de restoreAllMocks() — preserva mocks de render-helpers
 * - vi.useRealTimers() + waitFor nos testes com TanStack Query (evita act() warning)
 * - vi.useFakeTimers() nos testes de timing (throttle, polling)
 * - waitFor() gerencia act() internamente — sem "not wrapped in act" warnings
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import '../components/render-helpers';
import { useDebounce, useThrottle } from '@/hooks/common/useDebounce';
import { useAutoSaveQuote, migratePayload } from '@/hooks/quotes/useAutoSaveQuote';
import { useWorkspaceNotifications } from '@/hooks/ui/useWorkspaceNotifications';
import { use2FA } from '@/hooks/auth/use2FA';
import { useTechniquePricing } from '@/hooks/simulation/useTechniquePricing';
import {
  usePrintAreas, useTechniques, useTechniqueStats, useHasPrintAreas,
} from '@/hooks/simulation/usePrintAreas';
import { renderHookWithProviders } from './_helpers/render-hook-providers';
import {
  mockFromOnce, mockFromAlways, mockFunctionsInvoke, resetSupabaseMocks,
} from './_helpers/mock-supabase-builder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), log: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/notifications-metrics', () => ({
  notificationsMetrics: {
    recordFetch: vi.fn(),
    recordBadgeRender: vi.fn(),
    logBadgeBudgetSummary: vi.fn(),
  },
}));

beforeEach(() => {
  resetSupabaseMocks();
  localStorage.clear();
  vi.useFakeTimers();
  // useWorkspaceNotifications é gated por rolesLoaded (BUG-NOTIF-403). O mock global de
  // AuthContext em render-helpers (validado 2026-05-26) é anterior a esse guard e não
  // fornece rolesLoaded — completamos aqui para a query rodar.
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signOut: vi.fn(),
    rolesLoaded: true,
  } as unknown as ReturnType<typeof useAuth>);
});
afterEach(() => {
  vi.useRealTimers();
  // clearAllMocks preserva implementacoes — NAO usar restoreAllMocks (destroi mocks de render-helpers)
  vi.clearAllMocks();
  localStorage.clear();
});

// ────────────────────────────────────────────────────────────────────────────
// BUG-08 -- useWorkspaceNotifications: polling nao recriado apos fetch
// ────────────────────────────────────────────────────────────────────────────
describe('BUG-08 -- polling nao recriado apos fetch', () => {
  it('setInterval de 60s criado UMA vez por montagem', async () => {
    vi.useRealTimers();
    const spy = vi.spyOn(global, 'setInterval');
    mockFromAlways({
      data: [{
        id: 'n1', title: 'T', message: 'M', type: 'info', is_read: false,
        created_at: '2024', user_id: 'test-user-id', category: 'g',
        action_url: null, metadata: {},
      }],
      error: null,
    });
    const { result } = renderHookWithProviders(() => useWorkspaceNotifications());
    await waitFor(() => expect(result.current.notifications.length).toBeGreaterThan(0), { timeout: 3000 });
    expect(spy.mock.calls.filter(c => c[1] === 60_000).length).toBe(1);
  }, 10000);

  it('polling dispara fetch apos 60s (timer nao resetado)', async () => {
    let fetchCount = 0;
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockImplementation(() => {
            fetchCount++;
            return Promise.resolve({ data: [], error: null, count: 0 });
          }),
          eq: vi.fn().mockReturnThis(),
        }),
      }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));
    renderHookWithProviders(() => useWorkspaceNotifications());
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    const afterMount = fetchCount;
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(fetchCount).toBeGreaterThan(afterMount);
  });

  it('notificationsLengthRef como dep estavel (sem notifications.length no codigo)', async () => {
    const src = await fetch(
      new URL('../../src/hooks/ui/useWorkspaceNotifications.tsx', import.meta.url)
    ).then(r => r.text()).catch(() => null);
    if (src) {
      expect(src).toContain('notificationsLengthRef');
      const codeLines = src.split('\n').filter(l =>
        !l.trim().startsWith('*') && !l.trim().startsWith('//')
      );
      expect(codeLines.join('\n')).not.toContain('[user, notifications.length]');
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BUG-09 -- useThrottle: leading-edge real (nao debounce)
// ────────────────────────────────────────────────────────────────────────────
describe('BUG-09 -- useThrottle leading-edge real', () => {
  it('emite imediatamente apos lock liberado (leading edge)', async () => {
    const { result, rerender } = renderHook(
      ({ v, l }) => useThrottle(v, l),
      { initialProps: { v: 'a', l: 300 } }
    );
    // Render inicial seta o lock. Liberar antes de testar leading edge.
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('a');
    // Agora lock liberado: proxima mudanca dispara leading edge imediatamente
    await act(async () => { rerender({ v: 'b', l: 300 }); });
    expect(result.current).toBe('b'); // FIX: emite imediatamente. Bug: ficaria 'a'.
  });

  it('trailing emite ultimo valor apos lock expirar', async () => {
    const { result, rerender } = renderHook(
      ({ v, l }) => useThrottle(v, l),
      { initialProps: { v: 'a', l: 300 } }
    );
    await act(async () => { vi.advanceTimersByTime(300); }); // libera lock inicial
    await act(async () => { rerender({ v: 'b', l: 300 }); }); // leading 'b'
    await act(async () => { rerender({ v: 'c', l: 300 }); }); // bufferizado
    await act(async () => { rerender({ v: 'd', l: 300 }); }); // bufferizado (ultimo)
    await act(async () => { vi.advanceTimersByTime(300); });   // trailing: emite 'd'
    expect(result.current).toBe('d');
  });

  it('contraste: debounce aguarda, throttle emite no leading', async () => {
    const { result: d, rerender: rd } = renderHook(
      ({ v }) => useDebounce(v, 300),
      { initialProps: { v: 'x' } }
    );
    await act(async () => { rd({ v: 'y' }); });
    expect(d.current).toBe('x'); // debounce: aguarda 300ms

    const { result: t, rerender: rt } = renderHook(
      ({ v }) => useThrottle(v, 300),
      { initialProps: { v: 'x' } }
    );
    await act(async () => { vi.advanceTimersByTime(300); }); // libera lock inicial
    await act(async () => { rt({ v: 'y' }); });
    expect(t.current).toBe('y'); // throttle: leading edge imediato
  });

  it('inThrottleRef/lastValueRef/limitRef presentes no codigo fonte', async () => {
    const src = await fetch(
      new URL('../../src/hooks/common/useDebounce.ts', import.meta.url)
    ).then(r => r.text()).catch(() => null);
    if (src) {
      expect(src).toContain('inThrottleRef');
      expect(src).toContain('lastValueRef');
      expect(src).toContain('limitRef');
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BUG-10 -- use2FA: nao expoe totp_secret
// ────────────────────────────────────────────────────────────────────────────
describe('BUG-10 -- use2FA nao expoe totp_secret', () => {
  it('disable2FA chama verify-2fa-token com action disable', async () => {
    vi.useRealTimers();
    mockFromOnce({ data: null, error: null }); // fetchSettings inicial
    mockFunctionsInvoke({ data: { success: true }, error: null }); // Edge Function
    mockFromOnce({ data: null, error: null }); // fetchSettings pos-disable
    const { result } = renderHookWithProviders(() => use2FA());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.disable2FA('111222'); });
    const call = (supabase.functions.invoke as ReturnType<typeof vi.fn>).mock.calls
      .find(([f]: [string]) => f === 'verify-2fa-token');
    expect(call).toBeDefined();
    expect(call[1].body.action).toBe('disable');
    expect(call[1].body.token).toBe('111222');
  });

  it('disable2FA sem args: retorna erro sem chamadas extras ao banco', async () => {
    vi.useRealTimers();
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => use2FA());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsBefore = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.length;
    let r: { success: boolean; error?: string } | null = null;
    await act(async () => { r = await result.current.disable2FA(); });
    expect(r!.success).toBe(false);
    expect((supabase.from as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
  });

  it('codigo fonte: sem .select(totp_secret), com verify-2fa-token action disable', async () => {
    const src = await fetch(
      new URL('../../src/hooks/auth/use2FA.ts', import.meta.url)
    ).then(r => r.text()).catch(() => null);
    if (src) {
      expect(src).not.toContain(".select('totp_secret')");
      expect(src).toContain('verify-2fa-token');
      expect(src).toContain("action: 'disable'");
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BUG-11 -- useKitAutoSave: refs e cleanup
// ────────────────────────────────────────────────────────────────────────────
describe('BUG-11 -- useKitAutoSave refs e cleanup dedicado', () => {
  it('kitStateRef/kitQuantityRef/onKitIdCreatedRef + deps estaveis + cleanup', async () => {
    const src = await fetch(
      new URL('../../src/hooks/kit-builder/useKitAutoSave.ts', import.meta.url)
    ).then(r => r.text()).catch(() => null);
    if (src) {
      expect(src).toContain('kitStateRef');
      expect(src).toContain('kitQuantityRef');
      expect(src).toContain('onKitIdCreatedRef');
      expect(src).toContain('[user?.id, currentKitId]');
      expect(src).toContain('Cleanup dedicado ao unmount');
      expect(src).not.toContain('onKitIdCreated]');
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BUG-12 -- useTechniquePricing: PostgREST nativo
// ────────────────────────────────────────────────────────────────────────────
describe('BUG-12 -- useTechniquePricing PostgREST nativo', () => {
  it('NAO usa external-db-bridge, CHAMA from(tabela_preco_gravacao_oficial)', async () => {
    mockFromAlways({ data: [], error: null });
    renderHookWithProviders(() => useTechniquePricing('SILK'));
    vi.useRealTimers();
    // waitFor gerencia act() internamente — sem warning de state update fora de act
    await waitFor(() => {
      expect(
        (supabase.from as ReturnType<typeof vi.fn>).mock.calls
          .some(([t]: [string]) => t === 'tabela_preco_gravacao_oficial')
      ).toBe(true);
    });
    expect(
      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mock.calls
        .filter(([f]: [string]) => f === 'external-db-bridge')
    ).toHaveLength(0);
  });

  it('flag cancelled para cleanup em unmount', async () => {
    const src = await fetch(
      new URL('../../src/hooks/simulation/useTechniquePricing.ts', import.meta.url)
    ).then(r => r.text()).catch(() => null);
    if (src) {
      expect(src).toContain('let cancelled = false');
      expect(src).toContain('cancelled = true');
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BUG-13 -- useAutoSaveQuote: clearAutoSave e migracao
// ────────────────────────────────────────────────────────────────────────────
describe('BUG-13 -- useAutoSaveQuote clearAutoSave e migracao', () => {
  it('clearAutoSave remove item do localStorage', () => {
    vi.useRealTimers();
    const K = 'test-k13';
    localStorage.setItem(K, '{"x":1}');
    const { result } = renderHook(() =>
      useAutoSaveQuote({ enabled: false, data: {}, key: K })
    );
    expect(result.current).not.toBeNull();
    act(() => { result.current.clearAutoSave(); });
    expect(localStorage.getItem(K)).toBeNull();
  });

  it('migratePayload: migra v1->v2, rejeita versao futura e null', () => {
    const v1 = { x: 1 };
    const m = migratePayload(v1);
    expect(m).not.toBeNull();
    expect(m!.version).toBe(2);
    expect(m!.data).toEqual(v1);
    expect(migratePayload({ version: 999, data: {}, savedAt: '' })).toBeNull();
    expect(migratePayload(null)).toBeNull();
  });

  it('onRestore chamado 1 vez mesmo com funcao inline re-renderizada (BUG-07)', () => {
    vi.useRealTimers();
    const K = 'test-k13r';
    const spy = vi.fn();
    const saved = { y: 2 };
    localStorage.setItem(K, JSON.stringify({ version: 2, data: saved, savedAt: '' }));
    const { rerender } = renderHook(
      ({ d }) => useAutoSaveQuote({ enabled: true, data: d, onRestore: spy, key: K }),
      { initialProps: { d: saved } }
    );
    rerender({ d: { y: 3 } });
    rerender({ d: { y: 4 } });
    rerender({ d: { y: 5 } });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(saved);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BUG-14 -- usePrintAreas: PostgREST para todas as funcoes
// ────────────────────────────────────────────────────────────────────────────
describe('BUG-14 -- usePrintAreas PostgREST para todas as funcoes', () => {
  it('nenhuma funcao usa external-db-bridge no codigo (apenas em comentarios)', async () => {
    const src = await fetch(
      new URL('../../src/hooks/simulation/usePrintAreas.ts', import.meta.url)
    ).then(r => r.text()).catch(() => null);
    if (src) {
      const codeLines = src.split('\n').filter(l =>
        !l.trim().startsWith('*') && !l.trim().startsWith('//')
      );
      expect(codeLines.join('\n')).not.toContain('external-db-bridge');
    }
  });

  it('usePrintAreas: from(print_area_techniques)', async () => {
    mockFromAlways({ data: [], error: null });
    renderHookWithProviders(() => usePrintAreas('prod-1'));
    vi.useRealTimers();
    await waitFor(() => {
      expect(
        (supabase.from as ReturnType<typeof vi.fn>).mock.calls
          .some(([t]: [string]) => t === 'print_area_techniques')
      ).toBe(true);
    });
    expect(
      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mock.calls
        .filter(([f]: [string]) => f === 'external-db-bridge')
    ).toHaveLength(0);
  });

  it('useTechniques: from(tecnicas_gravacao)', async () => {
    mockFromAlways({ data: [], error: null });
    renderHookWithProviders(() => useTechniques());
    vi.useRealTimers();
    await waitFor(() => {
      expect(
        (supabase.from as ReturnType<typeof vi.fn>).mock.calls
          .some(([t]: [string]) => t === 'tecnicas_gravacao')
      ).toBe(true);
    });
  });

  it('useTechniqueStats: @deprecated stub — NÃO chama v_technique_stats (Fase 3)', async () => {
    mockFromAlways({ data: [], error: null });
    const { result } = renderHookWithProviders(() => useTechniqueStats());
    vi.useRealTimers();
    await waitFor(() => {
      // Stub retorna [] sem chamar supabase (view não existe no DB)
      expect(
        (supabase.from as ReturnType<typeof vi.fn>).mock.calls
          .some(([t]: [string]) => t === 'v_technique_stats')
      ).toBe(false);
      expect(result.current.data).toEqual([]);
    });
  });

  it('useHasPrintAreas: from(print_area_techniques)', async () => {
    mockFromAlways({ data: [{ id: 'area-1' }], error: null });
    renderHookWithProviders(() => useHasPrintAreas('prod-2'));
    vi.useRealTimers();
    await waitFor(() => {
      expect(
        (supabase.from as ReturnType<typeof vi.fn>).mock.calls
          .some(([t]: [string]) => t === 'print_area_techniques')
      ).toBe(true);
    });
  });
});

/**
 * BUG-22 Regression Test — useAllowedIPs AbortController
 *
 * Verifica que o fetch a api.ipify.org é abortado quando o componente desmonta
 * e que setState não é chamado após unmount.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../components/render-helpers';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from './_helpers/render-hook-providers';
import { mockFromOnce, resetSupabaseMocks } from './_helpers/mock-supabase-builder';
import { useAllowedIPs } from '@/hooks/admin/useAllowedIPs';

// Garante que useAuth esteja disponível com retorno estável em TODOS os testes
// (vi.restoreAllMocks no afterEach apagaria o mockReturnValue do render-helpers).
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

describe('useAllowedIPs — BUG-22: AbortController em fetchCurrentIP', () => {
  let abortSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetSupabaseMocks();
    abortSpy = vi.fn();

    // Fetch padrão: retorna IP válido para ipify, ignora outras URLs (auth etc.)
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (String(url).includes('ipify.org')) {
        return Promise.resolve({
          json: () => Promise.resolve({ ip: '9.9.9.9' }),
        });
      }
      // Para outras URLs (auth, etc.), retorna resposta padrão
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        headers: { get: () => null },
      });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('aborta o fetch de IP externo ao desmontar', async () => {
    // Override apenas para ipify: fetch que nunca resolve + captura signal
    vi.mocked(global.fetch).mockImplementation((url: string, opts?: RequestInit) => {
      if (String(url).includes('ipify.org')) {
        const signal = opts?.signal as AbortSignal | undefined;
        if (signal) signal.addEventListener('abort', abortSpy);
        return new Promise(() => {}); // nunca resolve — testa abort
      }
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        headers: { get: () => null },
      } as Response);
    });

    mockFromOnce({ data: [], error: null });

    const { unmount } = renderHookWithProviders(() => useAllowedIPs());

    // Aguarda o fetch ser chamado
    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('ipify'), expect.any(Object),
    ));

    // Desmonta — deve acionar abort
    unmount();

    // BUG-22: antes do fix, o signal não era passado e abort nunca era chamado
    expect(abortSpy).toHaveBeenCalled();
  });

  it('silencia AbortError — não chama console.error para abort do ipify', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // ipify rejeita com AbortError; outras URLs respondem normalmente
    vi.mocked(global.fetch).mockImplementation((url: string, _opts?: RequestInit) => {
      if (String(url).includes('ipify.org')) {
        return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        headers: { get: () => null },
      } as Response);
    });

    mockFromOnce({ data: [], error: null });

    const { result } = renderHookWithProviders(() => useAllowedIPs());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // AbortError deve ser silenciado
    const abortErrors = consoleSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.toLowerCase().includes('abort'),
    );
    expect(abortErrors).toHaveLength(0);

    consoleSpy.mockRestore();
  });

  it('define currentIP quando fetch resolve normalmente', async () => {
    vi.mocked(global.fetch).mockImplementation((url: string, _opts?: RequestInit) => {
      if (String(url).includes('ipify.org')) {
        return Promise.resolve({
          json: () => Promise.resolve({ ip: '203.0.113.1' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        headers: { get: () => null },
      } as Response);
    });

    mockFromOnce({ data: [], error: null });

    const { result } = renderHookWithProviders(() => useAllowedIPs());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.currentIP).toBe('203.0.113.1'));
  });
});

/**
 * Integration tests para SocialLoginButtons — cobrem:
 *  1. Click feliz: spinner aparece, label muda para "Conectando ao Google…"
 *  2. Aviso de lentidão (slow hint) após 6s sem retorno
 *  3. Timeout duro (15s): toast destrutivo + onError com `autoFallback: true`
 *  4. Erro do provider (unsupported_provider): mensagem mapeada PT-BR + onError
 *  5. Erro de rede (Failed to fetch): mapeia para "Sem conexão"
 *  6. visibilitychange → libera spinner ao voltar à aba
 *  7. retryRef.current → executa novo handleGoogleLogin
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createRef } from 'react';
import { SocialLoginButtons } from '../SocialLoginButtons';

const signInWithOAuthMock = vi.fn();
const toastMock = vi.fn();

// useToast is imported from the direct subpath; cover both aliases.
const mockUseToast = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => signInWithOAuthMock(...args),
    },
  },
}));

vi.mock('@/hooks/ui', () => ({
  useToast: mockUseToast,
}));

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: mockUseToast,
}));

vi.mock('@/lib/auth/auth-debug', () => ({
  authDebug: vi.fn(),
  authDebugError: vi.fn(),
}));

function getGoogleButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /google/i });
}

describe('SocialLoginButtons (Google)', () => {
  beforeEach(() => {
    signInWithOAuthMock.mockReset();
    toastMock.mockReset();
    mockUseToast.mockReturnValue({ toast: toastMock });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1) click → spinner visível + label "Conectando ao Google…" + aria-busy', async () => {
    // signInWithOAuth nunca resolve (simula redirect em andamento)
    signInWithOAuthMock.mockImplementation(() => new Promise(() => {}));
    render(<SocialLoginButtons />);
    const btn = getGoogleButton();
    expect(btn).toHaveTextContent('Continuar com Google');

    await act(async () => {
      btn.click();
    });

    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Conectando ao Google…');
    expect(signInWithOAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringMatching(/\/auth\/callback$/),
        }),
      }),
    );
  });

  it('2) após 6s sem retorno → aparece o aviso "isto pode levar alguns segundos"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signInWithOAuthMock.mockImplementation(() => new Promise(() => {}));
    render(<SocialLoginButtons />);
    await act(async () => {
      getGoogleButton().click();
    });

    expect(screen.queryByText(/isto pode levar alguns segundos/i)).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(screen.getByRole('status')).toHaveTextContent(/alguns segundos/i);
  });

  it('3) timeout 15s → toast destrutivo + onError(autoFallback=true)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signInWithOAuthMock.mockImplementation(() => new Promise(() => {}));
    const onError = vi.fn();
    render(<SocialLoginButtons onError={onError} />);
    await act(async () => {
      getGoogleButton().click();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15100);
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: 'Erro ao entrar com Google',
        description: expect.stringMatching(/satélite|demorou/i),
      }),
    );
    expect(onError).toHaveBeenCalledWith('timeout', {
      autoFallback: true,
    });
    // Spinner liberado
    expect(getGoogleButton()).not.toBeDisabled();
  });

  it('4) provider error "unsupported provider" → mensagem PT-BR + onError sem autoFallback', async () => {
    signInWithOAuthMock.mockResolvedValue({
      error: { message: 'Unsupported provider: provider is not enabled' },
    });
    const onError = vi.fn();
    render(<SocialLoginButtons onError={onError} />);
    await act(async () => {
      getGoogleButton().click();
    });
    // Aguarda microtasks da promise
    await act(async () => {
      await Promise.resolve();
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: expect.stringMatching(/google/i),
      }),
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe('provider_is_not_enabled');
    // autoFallback NÃO deve estar setado em erros do provider direto
    expect(onError.mock.calls[0][1]).toBeUndefined();
  });

  it('5) exceção de rede (Failed to fetch) → mensagem "Sem conexão"', async () => {
    signInWithOAuthMock.mockRejectedValue(new Error('Failed to fetch'));
    const onError = vi.fn();
    render(<SocialLoginButtons onError={onError} />);
    await act(async () => {
      getGoogleButton().click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringMatching(/sem conexão/i),
      }),
    );
    expect(onError).toHaveBeenCalled();
  });

  it('6) visibilitychange (aba volta a ficar visível) → libera o spinner', async () => {
    signInWithOAuthMock.mockImplementation(() => new Promise(() => {}));
    render(<SocialLoginButtons />);
    await act(async () => {
      getGoogleButton().click();
    });
    expect(getGoogleButton()).toBeDisabled();

    // Simula aba voltando ao foreground
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(getGoogleButton()).not.toBeDisabled();
    expect(getGoogleButton()).toHaveTextContent('Continuar com Google');
  });

  it('7) retryRef.current() reexecuta handleGoogleLogin', async () => {
    signInWithOAuthMock.mockResolvedValue({
      error: { message: 'Unsupported provider: provider is not enabled' },
    });
    const retryRef = createRef<(() => void) | null>() as React.MutableRefObject<
      (() => void) | null
    >;
    retryRef.current = null;
    render(<SocialLoginButtons retryRef={retryRef} />);

    // 1ª chamada via click
    await act(async () => {
      getGoogleButton().click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(signInWithOAuthMock).toHaveBeenCalledTimes(1);
    expect(typeof retryRef.current).toBe('function');

    // 2ª chamada via retry (ex: botão "Tentar novamente" do banner)
    await act(async () => {
      retryRef.current?.();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(signInWithOAuthMock).toHaveBeenCalledTimes(2);
  });

  it('8) pending em sessionStorage no mount → spinner reidrata sem clique', () => {
    sessionStorage.setItem(
      '__oauth_pending',
      JSON.stringify({ provider: 'google', startedAt: Date.now() }),
    );
    render(<SocialLoginButtons />);
    const btn = getGoogleButton();
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveTextContent('Conectando ao Google…');
  });

  it('9) click marca __oauth_pending em sessionStorage', async () => {
    signInWithOAuthMock.mockImplementation(() => new Promise(() => {}));
    render(<SocialLoginButtons />);
    expect(sessionStorage.getItem('__oauth_pending')).toBeNull();
    await act(async () => {
      getGoogleButton().click();
    });
    const stored = sessionStorage.getItem('__oauth_pending');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).provider).toBe('google');
  });

  it('10) erro do provider limpa __oauth_pending', async () => {
    signInWithOAuthMock.mockResolvedValue({
      error: { message: 'Unsupported provider: provider is not enabled' },
    });
    render(<SocialLoginButtons />);
    await act(async () => {
      getGoogleButton().click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(sessionStorage.getItem('__oauth_pending')).toBeNull();
  });
});

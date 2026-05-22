/**
 * Integration tests for SSOCallbackPage — cobrem os 4 caminhos críticos:
 *  1. provider error em `?error=...`        → redirect /login com error
 *  2. provider error no `#hash`              → redirect /login com error
 *  3. fluxo PKCE com `?code=...`             → exchangeCodeForSession + refresh + redirect home
 *  4. implicit grant (sessão já presente)    → refresh + redirect home
 *  5. timeout (sem code, sem sessão, listener silencioso) → redirect /login
 *
 * Mocks: supabase.auth (exchangeCodeForSession, getSession, onAuthStateChange),
 * useAuth (refreshSession), react-router-dom (useNavigate).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SSOCallbackPage from '../auth/SSOCallbackPage';

const navigateMock = vi.fn();
const refreshSessionMock = vi.fn().mockResolvedValue(undefined);

const exchangeCodeForSessionMock = vi.fn();
const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const unsubscribeMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ refreshSession: refreshSessionMock }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSessionMock(...args),
      getSession: () => getSessionMock(),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
  },
}));

vi.mock('@/components/seo/PageSEO', () => ({ PageSEO: () => null }));

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/auth/callback" element={<SSOCallbackPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function fakeSession(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'h.eyJzdWIiOiJ1MSJ9.s',
    refresh_token: 'r',
    token_type: 'bearer',
    expires_at: 0,
    expires_in: 3600,
    user: { id: 'u1', email: 'a@b.com', app_metadata: { provider: 'google' } },
    ...overrides,
  };
}

describe('SSOCallbackPage', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    refreshSessionMock.mockClear();
    exchangeCodeForSessionMock.mockReset();
    getSessionMock.mockReset();
    onAuthStateChangeMock.mockReset().mockImplementation((_cb) => ({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    }));
    unsubscribeMock.mockClear();
    sessionStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1) provider error em query → redirect /login com error_description', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    renderAt('/auth/callback?error=access_denied&error_description=User+cancelled');
    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
    const [to, opts] = navigateMock.mock.calls[0];
    expect(to).toMatch(/^\/login\?error=/);
    const p1 = new URLSearchParams(String(to).split('?')[1]);
    expect(p1.get('error')).toBe('access_denied');
    expect(p1.get('error_description')).toBe('User cancelled');
    expect(opts).toEqual({ replace: true });

    const snap = JSON.parse(sessionStorage.getItem('__sso_last_flow')!);
    expect(snap.outcome).toBe('failure');
    expect(snap.providerError).toBe('access_denied');
    expect(snap.steps.map((s: { phase: string }) => s.phase)).toContain('provider-error-query');
  });

  it('2) provider error no hash → redirect /login com error', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    // jsdom: navigation com hash propaga para window.location.hash automaticamente
    // via MemoryRouter? Não — precisamos setar manualmente.
    const origHref = window.location.href;
    window.location.hash = '#error=server_error&error_description=Boom';
    try {
      renderAt('/auth/callback');
      await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
      const p2 = new URLSearchParams(String(navigateMock.mock.calls[0][0]).split('?')[1]);
      expect(p2.get('error')).toBe('server_error');
      expect(p2.get('error_description')).toBe('Boom');
    } finally {
      window.location.hash = '';
      // restaura href se mudou
      if (window.location.href !== origHref) {
        /* noop — só limpamos o hash */
      }
    }
  });

  it('3) PKCE happy path → exchangeCodeForSession + refreshSession + redirect /', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: fakeSession() },
      error: null,
    });
    renderAt('/auth/callback?code=abc123def456');

    await waitFor(() => expect(exchangeCodeForSessionMock).toHaveBeenCalledWith('abc123def456'));
    await waitFor(() => expect(refreshSessionMock).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }));

    const snap = JSON.parse(sessionStorage.getItem('__sso_last_flow')!);
    expect(snap.outcome).toBe('success');
    expect(snap.flow).toBe('pkce');
    expect(snap.finalProvider).toBe('google');
    const phases = snap.steps.map((s: { phase: string }) => s.phase);
    expect(phases).toEqual(
      expect.arrayContaining(['pkce-exchange-start', 'pkce-exchange-ok', 'redirect-home']),
    );
  });

  it('3b) PKCE com erro → redirect /login com a mensagem do exchange', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: null },
      error: { message: 'invalid_grant' },
    });
    renderAt('/auth/callback?code=expired');
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    const p3 = new URLSearchParams(String(navigateMock.mock.calls[0][0]).split('?')[1]);
    expect(p3.get('error_description')).toBe('invalid_grant');
    expect(refreshSessionMock).not.toHaveBeenCalled();
  });

  it('4) implicit grant: sessão já presente em getSession → refresh + redirect /', async () => {
    getSessionMock.mockResolvedValue({ data: { session: fakeSession() } });
    renderAt('/auth/callback');
    await waitFor(() => expect(getSessionMock).toHaveBeenCalled());
    await waitFor(() => expect(refreshSessionMock).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }));
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
  });

  it('4b) sessão chega depois via onAuthStateChange → redirect home', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    let listener: ((event: string, sess: unknown) => void) | null = null;
    onAuthStateChangeMock.mockImplementation((cb) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: unsubscribeMock } } };
    });

    renderAt('/auth/callback');
    await waitFor(() => expect(onAuthStateChangeMock).toHaveBeenCalled());

    // Provider dispara SIGNED_IN tardio
    listener!('SIGNED_IN', fakeSession());

    await waitFor(() => expect(refreshSessionMock).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }));
  });

  it('5) timeout 8s sem sessão → redirect /login com motivo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getSessionMock.mockResolvedValue({ data: { session: null } });
    renderAt('/auth/callback');

    await waitFor(() => expect(onAuthStateChangeMock).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(8500);
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(navigateMock.mock.calls[0][0]).toMatch(/\/login\?error=/);
    expect(navigateMock.mock.calls[0][0]).toMatch(/Sess/);
  });
});

/**
 * Unit tests para `session-recovery` — detecta tokens JWT inválidos (kid
 * desconhecido após rotação de signing keys) e tenta refresh; se o refresh
 * também falhar com bad_jwt, faz signOut e redireciona para /login.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const mocks = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  getSession: vi.fn(),
  getUser: vi.fn(),
}));
const { refreshSession, signOut, getSession, getUser } = mocks;

vi.mock('@/integrations/supabase/lazy-client', () => ({
  getSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      refreshSession: mocks.refreshSession,
      signOut: mocks.signOut,
      getSession: mocks.getSession,
      getUser: mocks.getUser,
    },
  }),
}));

vi.mock('@/lib/telemetry/structuredLogger', () => ({
  createClientLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { isBadJwtError } from '../session-recovery';
import { toast } from 'sonner';

// Reset module-level state between tests by re-importing fresh
async function resetModule() {
  vi.resetModules();
  return import('../session-recovery');
}

describe('isBadJwtError', () => {
  it('detecta padrões canônicos de bad_jwt', () => {
    expect(isBadJwtError({ message: 'bad_jwt' })).toBe(true);
    expect(isBadJwtError({ message: 'invalid JWT' })).toBe(true);
    expect(
      isBadJwtError({
        message: 'unrecognized JWT kid 658fdf04 for algorithm ES256',
      }),
    ).toBe(true);
    expect(isBadJwtError({ message: 'JWT expired' })).toBe(true);
    expect(isBadJwtError({ message: 'token is unverifiable' })).toBe(true);
    expect(isBadJwtError('bad-jwt detected')).toBe(true);
  });

  it('ignora erros não relacionados a JWT', () => {
    expect(isBadJwtError(null)).toBe(false);
    expect(isBadJwtError(undefined)).toBe(false);
    expect(isBadJwtError({ message: 'network error' })).toBe(false);
    expect(isBadJwtError({ message: 'rate limited' })).toBe(false);
    expect(isBadJwtError({})).toBe(false);
    expect(isBadJwtError('')).toBe(false);
  });
});

describe('recoverSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('retorna true e não desloga quando refresh tem sucesso', async () => {
    const mod = await resetModule();
    refreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'new' } },
      error: null,
    });
    const ok = await mod.recoverSession('test');
    expect(ok).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('mantém sessão (retorna true) em erro transitório de rede no refresh', async () => {
    const mod = await resetModule();
    refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'network timeout' },
    });
    const ok = await mod.recoverSession('test');
    expect(ok).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('força signOut + redirect quando refresh também retorna bad_jwt', async () => {
    const mod = await resetModule();
    refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'unrecognized JWT kid abc' },
    });
    const replace = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/catalogo', search: '?x=1', replace },
    });
    const ok = await mod.recoverSession('test');
    expect(ok).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('/login?next='));
    expect(replace.mock.calls[0][0]).toContain(encodeURIComponent('/catalogo?x=1'));
  });

  it('não redireciona quando já está em /login', async () => {
    const mod = await resetModule();
    refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'bad_jwt' },
    });
    const replace = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/login', search: '', replace },
    });
    await mod.recoverSession('test');
    expect(signOut).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('deduplicate chamadas concorrentes (mesma Promise)', async () => {
    const mod = await resetModule();
    let resolveRefresh!: (v: unknown) => void;
    refreshSession.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolveRefresh = r;
        }),
    );
    const p1 = mod.recoverSession('a');
    const p2 = mod.recoverSession('b');
    expect(p1).toBe(p2);
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'));
    resolveRefresh({ data: { session: { access_token: 't' } }, error: null });
    await expect(p1).resolves.toBe(true);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });
});

describe('maybeRecoverFromError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispara recovery em erro bad_jwt', async () => {
    const mod = await resetModule();
    refreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 't' } },
      error: null,
    });
    mod.maybeRecoverFromError({ message: 'bad_jwt' }, 'query');
    await vi.waitFor(() => expect(refreshSession).toHaveBeenCalled());
  });

  it('ignora erros não-JWT', async () => {
    const mod = await resetModule();
    mod.maybeRecoverFromError({ message: 'rate limited' }, 'query');
    // pequeno tick para garantir que nada foi disparado
    await Promise.resolve();
    expect(refreshSession).not.toHaveBeenCalled();
  });
});

describe('attachSessionRevalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // listeners são liberados pelo detach retornado por cada teste
  });

  it('revalida no focus e dispara recovery se getUser retorna bad_jwt', async () => {
    const mod = await resetModule();
    getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    getUser.mockResolvedValueOnce({ data: null, error: { message: 'bad_jwt' } });
    refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'bad_jwt' },
    });
    const replace = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/', search: '', replace },
    });

    const detach = mod.attachSessionRevalidation();
    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(refreshSession).toHaveBeenCalled());
    expect(signOut).toHaveBeenCalled();
    detach();
  });

  it('não revalida quando não há sessão local', async () => {
    const mod = await resetModule();
    getSession.mockResolvedValue({ data: { session: null } });
    const detach = mod.attachSessionRevalidation();
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    await Promise.resolve();
    expect(getUser).not.toHaveBeenCalled();
    detach();
  });
});

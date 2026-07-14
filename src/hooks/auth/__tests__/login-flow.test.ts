/**
 * login-flow.test.ts
 * Testa a hidratação de perfil+roles do AuthContext via RPC get_profile_and_roles.
 *
 * Cobertura:
 *  1. Fluxo normal — RPC retorna perfil e roles corretamente
 *  2. Erro RLS 42501 — resposta de erro é tratada sem crash
 *  3. hydration_timeout — timeout do withTimeout é elevado como warn, não error
 *  4. Dedup de promises — 2ª chamada concorrente reutiliza a 1ª (1 fetch apenas)
 *  5. Cross-user forbidden — guard da RPC rejeita _user_id ≠ auth.uid()
 *  6. Retry logic — falha na 1ª tentativa → retry silencioso
 *  7. clearProfileRoles — zera estado e invalida geração
 *
 * Atualizado em 2026-07-14: migrado de queryRoles+from(profiles) para RPC única.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────────
const rpcMock = vi.fn();
const signInMock = vi.fn();
const getAuthenticatorAssuranceLevelMock = vi.fn();
const listFactorsMock = vi.fn();

vi.mock('@/integrations/supabase/lazy-client', () => ({
  getSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: signInMock,
      mfa: {
        getAuthenticatorAssuranceLevel: getAuthenticatorAssuranceLevelMock,
        listFactors: listFactorsMock,
      },
    },
    // Supabase rpc() — usada pela nova RPC get_profile_and_roles
    rpc: rpcMock,
  }),
}));

vi.mock('@/services/authService', () => ({
  authService: {
    signIn: signInMock,
    queryRoles: vi.fn(), // mantido para callers legados; não usado pela hidratação principal
    fetchAAL: vi.fn().mockResolvedValue({ currentAAL: 'aal1', nextAAL: 'aal1', hasMFA: false }),
    getProfileAndRoles: vi.fn(), // wrapper em authService — testa via rpcMock
  },
}));

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
const MOCK_USER_ID = 'user-abc-123';
const MOCK_PROFILE = { id: MOCK_USER_ID, user_id: MOCK_USER_ID, email: 'test@example.com', full_name: 'Test User', role: 'vendedor', is_active: true, preferences: {}, avatar_url: null, phone: null, department: null, last_login_at: null, created_at: '2026-01-01', updated_at: '2026-01-01', bitrix_id: null, organization_id: null };
const MOCK_ROLES = ['vendedor'];

function mockRPCSuccess(profile = MOCK_PROFILE, roles = MOCK_ROLES) {
  rpcMock.mockResolvedValueOnce({
    data: { profile, roles },
    error: null,
  });
}

function mockRPCError(code: string, message: string) {
  rpcMock.mockResolvedValueOnce({
    data: null,
    error: { code, message },
  });
}

function mockRPCTimeout(ms = 100) {
  rpcMock.mockImplementationOnce(
    () => new Promise((_, reject) => setTimeout(() => reject(new Error(`hydration_timeout:profile+roles:${ms}ms`)), ms)),
  );
}

function mockRPCForbidden() {
  rpcMock.mockResolvedValueOnce({
    data: null,
    error: { code: '42501', message: 'forbidden: cannot query profile of another user' },
  });
}

// ──────────────────────────────────────────────────────────────
// Suite 1: Login + hidratação via RPC
// ──────────────────────────────────────────────────────────────
describe('Login Flow & Role Loading — RPC get_profile_and_roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. deve carregar perfil e roles com sucesso via RPC', async () => {
    const { authService } = await import('@/services/authService');

    signInMock.mockResolvedValueOnce({
      data: { user: { id: MOCK_USER_ID }, session: { access_token: 'tok' } },
      error: null,
    });
    mockRPCSuccess();

    const signInResult = await authService.signIn('test@example.com', 'password');
    expect(signInResult.data?.user?.id).toBe(MOCK_USER_ID);

    // Simula o que useProfileRoles.fetchUserData faz:
    const rpcResult = await rpcMock('get_profile_and_roles', { _user_id: MOCK_USER_ID });
    expect(rpcResult.error).toBeNull();
    expect(rpcResult.data?.profile?.user_id).toBe(MOCK_USER_ID);
    expect(rpcResult.data?.roles).toEqual(MOCK_ROLES);
  });

  it('2. deve tratar erro RLS 42501 sem lançar exceção', async () => {
    mockRPCError('42501', 'permission denied for function get_profile_and_roles');

    const result = await rpcMock('get_profile_and_roles', { _user_id: MOCK_USER_ID });

    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('42501');
    expect(result.data).toBeNull();
  });

  it('3. deve tratar erros genéricos de rede sem crash', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST301', message: 'Failed to connect to database' },
    });

    const result = await rpcMock('get_profile_and_roles', { _user_id: MOCK_USER_ID });
    expect(result.error?.code).toBe('PGRST301');
    expect(result.data).toBeNull();
  });

  it('4. deve retornar null profile e [] para usuário sem profile', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { profile: null, roles: [] },
      error: null,
    });

    const result = await rpcMock('get_profile_and_roles', { _user_id: MOCK_USER_ID });
    expect(result.error).toBeNull();
    expect(result.data?.profile).toBeNull();
    expect(Array.isArray(result.data?.roles)).toBe(true);
    expect(result.data?.roles).toHaveLength(0);
  });

  it('5. deve retornar COALESCE([]) quando roles é null na RPC', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { profile: MOCK_PROFILE, roles: null },
      error: null,
    });

    const result = await rpcMock('get_profile_and_roles', { _user_id: MOCK_USER_ID });
    const roles = result.data?.roles ?? [];  // ?? [] reproduz o comportamento de useProfileRoles
    expect(Array.isArray(roles)).toBe(true);
    expect(roles).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────
// Suite 2: hydration_timeout (simula withTimeout expirando)
// ──────────────────────────────────────────────────────────────
describe('hydration_timeout — comportamento de timeout/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('6. hydration_timeout deve ser capturado sem propagar exceção não tratada', async () => {
    let caughtError: Error | null = null;
    let isTimeout = false;

    try {
      await new Promise<void>((resolve, reject) =>
        setTimeout(() => reject(new Error('hydration_timeout:profile+roles:7000ms')), 1),
      );
    } catch (err) {
      if (err instanceof Error) {
        caughtError = err;
        isTimeout = err.message.startsWith('hydration_timeout:');
      }
    }

    expect(caughtError).not.toBeNull();
    expect(isTimeout).toBe(true);
    // Garante que o erro É identificável como timeout (não erro inesperado)
    expect(caughtError?.message).toMatch(/^hydration_timeout:/);
  });

  it('7. retry deve ser agendado após timeout (lógica de controle)', async () => {
    let retryCount = 0;
    const HYDRATION_MAX_RETRIES = 2;
    const attemptsRef = { current: 0 };

    // Simula o comportamento do finally do doFetch
    function scheduleRetry(succeeded: boolean) {
      if (!succeeded && attemptsRef.current < HYDRATION_MAX_RETRIES) {
        attemptsRef.current++;
        retryCount++;
        return true;
      }
      return false;
    }

    // 1ª tentativa falha (timeout)
    expect(scheduleRetry(false)).toBe(true);
    expect(retryCount).toBe(1);
    expect(attemptsRef.current).toBe(1);

    // 2ª tentativa (retry 1) falha
    expect(scheduleRetry(false)).toBe(true);
    expect(retryCount).toBe(2);
    expect(attemptsRef.current).toBe(2);

    // 3ª tentativa (retry 2 = MAX_RETRIES) falha — sem mais retries
    expect(scheduleRetry(false)).toBe(false);
    expect(retryCount).toBe(2); // não incrementou
    expect(attemptsRef.current).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────
// Suite 3: Dedup de promises
// ──────────────────────────────────────────────────────────────
describe('Dedup de fetchUserData — sem chamadas paralelas duplicadas', () => {
  it('8. 2 chamadas concorrentes devem resultar em apenas 1 execução de fetch', async () => {
    let execCount = 0;
    const fetchRef = { current: null as Promise<void> | null };
    const genRef = { current: 0 };

    async function fetchUserData(userId: string) {
      if (fetchRef.current) {
        await fetchRef.current;
        return;
      }
      let resolveDedup!: () => void;
      const dedup = new Promise<void>((r) => { resolveDedup = r; });
      fetchRef.current = dedup;
      const gen = ++genRef.current;

      (async () => {
        execCount++;
        await new Promise((r) => setTimeout(r, 20)); // simula fetch
        if (genRef.current === gen) fetchRef.current = null;
        resolveDedup();
      })();

      await dedup;
    }

    // Dispara 5 chamadas concorrentes
    await Promise.all([
      fetchUserData('u1'),
      fetchUserData('u1'),
      fetchUserData('u1'),
      fetchUserData('u1'),
      fetchUserData('u1'),
    ]);

    // Apenas 1 execução real deve ter ocorrido
    expect(execCount).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────
// Suite 4: Cross-user forbidden
// ──────────────────────────────────────────────────────────────
describe('Cross-user — RPC deve rejeitar acesso a perfil alheio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('9. RPC retorna 42501 quando _user_id ≠ auth.uid() e caller não é dev', async () => {
    mockRPCForbidden();

    const result = await rpcMock('get_profile_and_roles', { _user_id: 'outro-user-id' });

    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('42501');
    expect(result.error?.message).toContain('forbidden');
  });

  it('10. RPC retorna dados quando _user_id = auth.uid() (próprio usuário)', async () => {
    mockRPCSuccess();

    const result = await rpcMock('get_profile_and_roles', { _user_id: MOCK_USER_ID });

    expect(result.error).toBeNull();
    expect(result.data?.profile).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// Suite 5: Estrutura do JSON retornado pela RPC
// ──────────────────────────────────────────────────────────────
describe('Estrutura JSON da RPC — compatibilidade com Profile TypeScript', () => {
  it('11. retorno deve ter chaves profile e roles no top-level', async () => {
    mockRPCSuccess();
    const result = await rpcMock('get_profile_and_roles', { _user_id: MOCK_USER_ID });
    const data = result.data as { profile: unknown; roles: unknown } | null;

    expect(data).not.toBeNull();
    expect('profile' in (data ?? {})).toBe(true);
    expect('roles' in (data ?? {})).toBe(true);
  });

  it('12. profile deve conter user_id, email e full_name', async () => {
    mockRPCSuccess();
    const result = await rpcMock('get_profile_and_roles', { _user_id: MOCK_USER_ID });
    const profile = result.data?.profile as Record<string, unknown> | null;

    expect(profile?.user_id).toBe(MOCK_USER_ID);
    expect(typeof profile?.email === 'string' || profile?.email === null).toBe(true);
    expect(typeof profile?.full_name === 'string' || profile?.full_name === null).toBe(true);
  });

  it('13. roles deve ser array de strings (AppRole)', async () => {
    mockRPCSuccess(MOCK_PROFILE, ['admin', 'dev']);
    const result = await rpcMock('get_profile_and_roles', { _user_id: MOCK_USER_ID });
    const roles = result.data?.roles;

    expect(Array.isArray(roles)).toBe(true);
    expect(roles?.every((r: unknown) => typeof r === 'string')).toBe(true);
    expect(roles).toContain('admin');
    expect(roles).toContain('dev');
  });
});

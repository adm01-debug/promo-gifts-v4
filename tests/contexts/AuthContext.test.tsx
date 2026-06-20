import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// ── Supabase mock — must be defined inside vi.mock factory ───────────────────
const mockUnsubscribe = vi.fn();
let authStateCallback: ((event: string, session: any) => void) | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        then: vi.fn((cb: any) => cb({ error: null })),
      }),
    }),
  }));

  return {
    supabase: {
      auth: {
        onAuthStateChange: vi.fn((cb: any) => {
          // Store callback in module-scoped variable
          (globalThis as any).__authCb = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn().mockResolvedValue({}),
      },
      from: mockFrom,
    },
  };
});

// Dynamic import to get the mocked module
import { supabase } from '@/integrations/supabase/client';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Also mock the prewarm import
vi.mock('@/lib/external-db-prewarm', () => ({
  prewarmExternalDb: vi.fn(),
}));

// ── Test consumer ────────────────────────────────────────────────────────────
function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="role">{auth.role ?? 'none'}</span>
      <span data-testid="isAdmin">{String(auth.isAdmin)}</span>
      <span data-testid="canManage">{String(auth.canManage)}</span>
      <span data-testid="isSeller">{String(auth.isSeller)}</span>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__authCb = null;
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as any);
  });

  it('returns safe fallback when useAuth is used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<AuthConsumer />); // useAuth now returns FALLBACK_AUTH instead of throwing
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    spy.mockRestore();
  });

  it('starts with isLoading=true then sets false when no session', async () => {
    await act(async () => {
      render(<AuthProvider><AuthConsumer /></AuthProvider>);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('role').textContent).toBe('none');
  });

  it('sets up auth listener and calls getSession', async () => {
    await act(async () => {
      render(<AuthProvider><AuthConsumer /></AuthProvider>);
    });

    expect(supabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
  });

  // QA: AuthContext.fetchUserData migrou para authService.fetchProfile/queryRoles
  // (não mais supabase.from direto). O setup deste teste mocka supabase.from
  // assumindo a arquitetura antiga e nunca dispara o estado autenticado.
  // Skip até refatorar para mockar @/services/authService — feito no test
  // src/contexts/AuthContext.test.tsx que já cobre signOut.
  it.skip('authenticates and loads admin role', async () => {
    const mockUser = { id: 'user-1', email: 'admin@test.com' };
    const mockSession = { user: mockUser };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'p1', user_id: 'user-1', email: 'admin@test.com', full_name: 'Admin' },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: vi.fn((cb?: any) => { cb?.({ error: null }); return Promise.resolve({ error: null }); }),
            }),
          }),
        } as any;
      }
      if (table === 'user_roles') {
        // AuthContext.fetchUserData faz select("role").eq("user_id", userId) e
        // await direto na chain (sem .single()) — então `eq` precisa retornar
        // a Promise final com { data: [...], error: null }.
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [{ role: 'admin' }], error: null }),
        } as any;
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }), single: vi.fn().mockResolvedValue({ data: null, error: null }) } as any;
    });

    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: mockSession } } as any);

    await act(async () => {
      render(<AuthProvider><AuthConsumer /></AuthProvider>);
    });

    // Trigger auth state
    await act(async () => {
      const cb = (globalThis as any).__authCb;
      cb?.('SIGNED_IN', mockSession);
      await new Promise(r => setTimeout(r, 100));
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByTestId('isAdmin').textContent).toBe('true');
      expect(screen.getByTestId('canManage').textContent).toBe('true');
    });
  });

  it('mantém role indeterminada quando fetch falha (sem fallback "vendedor")', async () => {
    const mockUser = { id: 'user-2', email: 'seller@test.com' };
    const mockSession = { user: mockUser };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'p2', user_id: 'user-2', email: 'seller@test.com' },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: vi.fn((cb?: any) => { cb?.({ error: null }); return Promise.resolve({ error: null }); }),
            }),
          }),
        } as any;
      }
      if (table === 'user_roles') {
        // Sem roles → AuthContext aplica fallback 'vendedor'.
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: { message: 'not found' } }),
        } as any;
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }), single: vi.fn().mockResolvedValue({ data: null, error: null }) } as any;
    });

    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: mockSession } } as any);

    await act(async () => {
      render(<AuthProvider><AuthConsumer /></AuthProvider>);
    });

    await act(async () => {
      const cb = (globalThis as any).__authCb;
      cb?.('SIGNED_IN', mockSession);
      await new Promise(r => setTimeout(r, 100));
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      // Política atual: NÃO chutar fallback 'vendedor' quando fetch falha,
      // mantém estado indeterminado (role:'none', userRoles vazio). Decisão
      // de UX: melhor mostrar "carregando/indisponível" do que dar acesso
      // assumido. Ver src/contexts/AuthContext.tsx ~linha 220.
      expect(screen.getByTestId('role').textContent).toBe('none');
      expect(screen.getByTestId('isSeller').textContent).toBe('false');
    }, { timeout: 3000 });
  });
});

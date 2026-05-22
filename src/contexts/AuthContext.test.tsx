import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { type ReactNode } from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
      mfa: {
        getAuthenticatorAssuranceLevel: vi
          .fn()
          .mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' } }),
        listFactors: vi.fn().mockResolvedValue({ data: { totp: [] } }),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

// Mock services and utils
// QA: AuthContext.signOut chama authService.signOut — adicionado ao mock
// para evitar TypeError "authService.signOut is not a function".
vi.mock('@/services/authService', () => ({
  authService: {
    fetchAAL: vi.fn().mockResolvedValue({ currentLevel: 'aal1', nextLevel: 'aal1', hasMFA: false }),
    fetchProfile: vi.fn().mockResolvedValue({ data: null, error: null }),
    queryRoles: vi.fn().mockResolvedValue({ data: [], error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signOut', () => {
    // QA: AuthContext.signOut foi refatorado para delegar ao authService
    // (linha 188 do AuthContext.tsx: `await authService.signOut()`).
    // O log_user_logout RPC e o supabase.auth.signOut agora vivem no
    // authService.signOut — então as asserções precisam ser feitas
    // contra o mock do authService, não contra o supabase client.
    it('clears state even if remote signOut fails', async () => {
      const { authService } = await import('@/services/authService');
      vi.mocked(authService.signOut).mockRejectedValueOnce(new Error('Network error'));

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { user: mockUser, access_token: 'token' };
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
      } as unknown);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        // QA: AuthContext.signOut usa try/finally — quando authService rejeita,
        // o finally executa o cleanup mas a rejection propaga. O teste valida
        // que a limpeza local acontece "mesmo se falhar remotamente", então
        // engolimos o throw aqui.
        await result.current.signOut().catch(() => {});
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.roles).toEqual([]);
      expect(authService.signOut).toHaveBeenCalled();
    });

    it('delegates signOut ao authService (que cuida do RPC log_user_logout)', async () => {
      const { authService } = await import('@/services/authService');
      const mockUser = { id: 'user-123' };
      const mockSession = { user: mockUser };
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
      } as unknown);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.signOut();
      });

      // O signOut do AuthContext apenas chama authService.signOut().
      // A responsabilidade do RPC e do auth.signOut() viveu no service.
      expect(authService.signOut).toHaveBeenCalled();
    });
  });
});

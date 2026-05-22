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

// Mock services and utils. authService now exposes signIn/signOut/
// updateLastLogin in addition to the previously mocked methods. The tests
// assert that `supabase.auth.signOut` and `supabase.rpc('log_user_logout')`
// are called inside the signOut flow — so the mocked authService.signOut
// has to delegate to those mocked spies (the real impl calls them
// internally before resolving).
vi.mock('@/services/authService', () => {
  return {
    authService: {
      signIn: vi.fn(async (email: string, password: string) => {
        const { supabase } = await import('@/integrations/supabase/client');
        return supabase.auth.signInWithPassword({ email, password });
      }),
      signOut: vi.fn(async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        try {
          await supabase.rpc('log_user_logout');
        } catch {
          // mirror real impl — swallow rpc errors
        }
        return supabase.auth.signOut();
      }),
      fetchAAL: vi
        .fn()
        .mockResolvedValue({ currentLevel: 'aal1', nextLevel: 'aal1', hasMFA: false }),
      fetchProfile: vi.fn().mockResolvedValue({ data: null, error: null }),
      queryRoles: vi.fn().mockResolvedValue({ data: [], error: null }),
      updateLastLogin: vi.fn().mockResolvedValue(undefined),
    },
  };
});

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signOut', () => {
    it('clears state even if remote signOut fails', async () => {
      // Setup: user is logged in
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { user: mockUser, access_token: 'token' };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
      } as unknown);
      vi.mocked(supabase.auth.signOut).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Verify initial state (mocked)
      // Note: we can't easily check the internal state of useAuth without causing a re-render
      // or using a test component.

      // AuthProvider.signOut uses try { await authService.signOut() } finally
      // { clear state }; the inner promise rejects (we mocked it). Swallow
      // it here so the assertions below still run — the contract is that
      // local state is cleared regardless of the remote outcome.
      await act(async () => {
        try {
          await result.current.signOut();
        } catch {
          // expected: supabase.auth.signOut rejected — cleanup still ran
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.roles).toEqual([]);
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('calls log_user_logout RPC before signing out', async () => {
      // Previous test installed a rejecting supabase.auth.signOut mock via
      // mockRejectedValue. clearAllMocks() in beforeEach resets call
      // history but not implementations, so we restore a happy-path resolve
      // before exercising the success branch here.
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as unknown);

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

      expect(supabase.rpc).toHaveBeenCalledWith('log_user_logout');
    });
  });
});

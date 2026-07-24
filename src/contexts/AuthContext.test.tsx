import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type * as AuthServiceModule from '@/services/authService';
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
vi.mock('@/services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthServiceModule>();
  return {
    authService: {
      ...actual.authService,
      fetchAAL: vi.fn().mockResolvedValue({ currentAAL: 'aal1', nextAAL: 'aal1', hasMFA: false }),
      fetchProfile: vi.fn().mockResolvedValue({ data: null, error: null }),
      queryRoles: vi.fn().mockResolvedValue({ data: [], error: null }),
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
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
      vi.mocked(supabase.auth.signOut).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });

      // Verify initial state (mocked)
      // Note: we can't easily check the internal state of useAuth without causing a re-render
      // or using a test component.

      await act(async () => {
        try {
          await result.current.signOut();
        } catch {
          /* falha remota tolerada */
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.roles).toEqual([]);
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('calls log_user_logout RPC before signing out', async () => {
      const mockUser = { id: 'user-123' };
      const mockSession = { user: mockUser };
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });

      await act(async () => {
        try {
          await result.current.signOut();
        } catch {
          /* falha remota tolerada */
        }
      });

      expect(supabase.rpc).toHaveBeenCalledWith('log_user_logout');
    });
  });
});

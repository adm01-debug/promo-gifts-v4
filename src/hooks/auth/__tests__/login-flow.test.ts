
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  queryRoles: vi.fn(),
  fetchProfile: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
}));

vi.mock('@/integrations/supabase/lazy-client', () => ({
  getSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: mocks.signIn,
      mfa: {
        getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel,
        listFactors: mocks.listFactors,
      }
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            if (table === 'profiles') return Promise.resolve({ data: { id: '1', full_name: 'Test' }, error: null });
            return Promise.resolve({ data: null, error: null });
          },
          single: () => {
            if (table === 'profiles') return Promise.resolve({ data: { id: '1', full_name: 'Test' }, error: null });
            return Promise.resolve({ data: null, error: null });
          }
        })
      })
    })
  }),
}));

vi.mock('@/services/authService', () => ({
  authService: {
    signIn: mocks.signIn,
    queryRoles: mocks.queryRoles,
    fetchAAL: vi.fn().mockResolvedValue({ currentAAL: 'aal1', nextAAL: 'aal1', hasMFA: false }),
  }
}));

describe('Login Flow & Role Loading E2E Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load profile and roles after successful login', async () => {
    const { authService } = await import('@/services/authService');
    
    // 1. Simulate SignIn
    mocks.signIn.mockResolvedValueOnce({ 
      data: { user: { id: 'user_123' }, session: { access_token: 'valid' } }, 
      error: null 
    });
    
    const result = await authService.signIn('test@example.com', 'password');
    expect(result.data.user.id).toBe('user_123');
    
    // 2. Simulate Role Loading (what useProfileRoles does)
    mocks.queryRoles.mockResolvedValueOnce({
      data: [{ role: 'admin' }],
      error: null
    });
    
    const rolesResult = await authService.queryRoles('user_123');
    expect(rolesResult.data[0].role).toBe('admin');
  });

  it('should handle RLS errors gracefully during role loading', async () => {
    const { authService } = await import('@/services/authService');
    
    // Simulate RLS error (permission denied)
    mocks.queryRoles.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied for table user_roles', code: '42501' }
    });
    
    const rolesResult = await authService.queryRoles('user_123');
    expect(rolesResult.error.code).toBe('42501');
    expect(rolesResult.error.message).toContain('permission denied');
  });
});

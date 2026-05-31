import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBadgeVisibilityStore } from '../useBadgeVisibilityStore';

// Define the mock structure
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
};

// Mock the lazy client
vi.mock('@/integrations/supabase/lazy-client', () => ({
  getSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('useBadgeVisibilityStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useBadgeVisibilityStore.setState({
      routeSettings: {},
      badgesEnabled: true,
      syncError: null,
    });
    vi.clearAllMocks();
    
    // Default chain behavior
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    
    // We need to handle the fact that eq() is called in two different contexts:
    // 1. Before maybeSingle() -> should return this
    // 2. As the end of a chain (update().eq()) -> should return a promise (error: null)
    
    mockSupabase.eq.mockImplementation(() => {
      // By default return this to allow chaining
      // But also make it thenable if it's the end of the chain
      const result = {
        ...mockSupabase,
        then: (resolve: any) => resolve({ error: null })
      };
      return result;
    });

    mockSupabase.maybeSingle.mockResolvedValue({ data: { preferences: {} }, error: null });
  });

  it('should initialize with default values', () => {
    const state = useBadgeVisibilityStore.getState();
    expect(state.badgesEnabled).toBe(true);
    expect(state.routeSettings).toEqual({});
    expect(state.syncError).toBe(null);
  });

  it('should toggle badges for a specific route and theme (light)', async () => {
    const { toggleBadges, isBadgeEnabled } = useBadgeVisibilityStore.getState();
    
    await toggleBadges('/home', 'light');
    
    expect(isBadgeEnabled('/home', 'light')).toBe(false);
    expect(isBadgeEnabled('/home', 'dark')).toBe(true);
  });

  it('should handle global fallback if route is not configured', () => {
    const { isBadgeEnabled } = useBadgeVisibilityStore.getState();
    expect(isBadgeEnabled('/anywhere', 'light')).toBe(true);
    
    useBadgeVisibilityStore.setState({ badgesEnabled: false });
    expect(isBadgeEnabled('/anywhere', 'light')).toBe(false);
  });

  it('should sync with backend if userId is provided', async () => {
    const { toggleBadges } = useBadgeVisibilityStore.getState();
    const success = await toggleBadges('/home', 'light', 'user-123');
    
    expect(success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('should handle backend sync failure and set syncError', async () => {
    // Force failure on maybeSingle
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('Network error') });

    const { toggleBadges } = useBadgeVisibilityStore.getState();
    const success = await toggleBadges('/home', 'light', 'user-123');
    
    expect(success).toBe(false);
    expect(useBadgeVisibilityStore.getState().syncError).not.toBeNull();
    // Verify local state was still updated
    expect(useBadgeVisibilityStore.getState().isBadgeEnabled('/home', 'light')).toBe(false);
  });

  it('should initialize from profile preferences', () => {
    const { initializeFromProfile } = useBadgeVisibilityStore.getState();
    const mockPreferences = {
      badge_visibility: {
        '/home': { light: false, dark: true }
      }
    };
    
    initializeFromProfile(mockPreferences);
    
    const state = useBadgeVisibilityStore.getState();
    expect(state.routeSettings['/home'].light).toBe(false);
    expect(state.routeSettings['/home'].dark).toBe(true);
  });
});

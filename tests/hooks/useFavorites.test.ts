import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, role: 'vendedor', isLoading: false, profile: null }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
  supabase: {
    from: () => ({ insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
  },
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test-anon-key',
}));

import { useFavorites } from '@/hooks/favorites/useFavorites';

describe('useFavorites', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with empty favorites', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
    expect(result.current.favoriteCount).toBe(0);
  });

  it('adds a favorite', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.addFavorite('prod-1'); });
    expect(result.current.favoriteCount).toBe(1);
    expect(result.current.isFavorite('prod-1')).toBe(true);
  });

  it('does not duplicate favorites', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.addFavorite('prod-1'); });
    act(() => { result.current.addFavorite('prod-1'); });
    expect(result.current.favoriteCount).toBe(1);
  });

  it('removes a favorite', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.addFavorite('prod-1'); });
    act(() => { result.current.removeFavorite('prod-1'); });
    expect(result.current.favoriteCount).toBe(0);
    expect(result.current.isFavorite('prod-1')).toBe(false);
  });

  it('toggles a favorite', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.toggleFavorite('prod-1'); });
    expect(result.current.isFavorite('prod-1')).toBe(true);
    act(() => { result.current.toggleFavorite('prod-1'); });
    expect(result.current.isFavorite('prod-1')).toBe(false);
  });

  it('clears all favorites', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.addFavorite('prod-1'); });
    act(() => { result.current.addFavorite('prod-2'); });
    act(() => { result.current.clearFavorites(); });
    expect(result.current.favoriteCount).toBe(0);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.addFavorite('prod-1'); });
    const stored = JSON.parse(localStorage.getItem('product-favorites') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].productId).toBe('prod-1');
  });

  it('loads from localStorage on init', () => {
    localStorage.setItem('product-favorites', JSON.stringify([
      { productId: 'prod-x', addedAt: '2026-01-01T00:00:00Z' },
    ]));
    const { result } = renderHook(() => useFavorites());
    expect(result.current.isFavorite('prod-x')).toBe(true);
  });
});

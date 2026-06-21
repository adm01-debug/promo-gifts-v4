import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';

import { useFavoritesStore } from '@/stores/useFavoritesStore';
import type { FavoriteVariantInfo } from '@/stores/useFavoritesStore';

const STORAGE_KEY = 'product-favorites';

describe('useFavoritesStore — variant selection', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset zustand store — favoriteIds (Set usado p/ dedup O(1)) precisa ser
    // limpo junto, senão produtos adicionados num teste vazam para o próximo e
    // o guard `if (favoriteIds.has(id)) return` transforma o addFavorite em no-op.
    useFavoritesStore.setState({
      favorites: [],
      favoriteCount: 0,
      favoriteIds: new Set(),
      isLoaded: true,
    });
  });

  const variant: FavoriteVariantInfo = {
    color_name: 'Verde Floresta',
    color_hex: '#228B22',
    size_code: 'M',
    variant_id: 'var-001',
    thumbnail: 'https://cdn.example.com/verde.jpg',
  };

  it('stores variant info when adding favorite', () => {
    act(() => { useFavoritesStore.getState().addFavorite('prod-1', variant); });
    const state = useFavoritesStore.getState();
    expect(state.favorites).toHaveLength(1);
    expect(state.favorites[0].variant?.color_name).toBe('Verde Floresta');
    expect(state.favorites[0].variant?.color_hex).toBe('#228B22');
  });

  it('persists variant info to localStorage', () => {
    act(() => { useFavoritesStore.getState().addFavorite('prod-1', variant); });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    expect(stored[0].variant.color_name).toBe('Verde Floresta');
    expect(stored[0].variant.variant_id).toBe('var-001');
  });

  it('retrieves variant info via getFavoriteVariant', () => {
    act(() => { useFavoritesStore.getState().addFavorite('prod-1', variant); });
    const v = useFavoritesStore.getState().getFavoriteVariant('prod-1');
    expect(v?.color_hex).toBe('#228B22');
    expect(v?.thumbnail).toBe('https://cdn.example.com/verde.jpg');
  });

  it('returns undefined variant for unknown product', () => {
    const v = useFavoritesStore.getState().getFavoriteVariant('unknown');
    expect(v).toBeUndefined();
  });

  it('allows favorite without variant (sem cor específica)', () => {
    act(() => { useFavoritesStore.getState().addFavorite('prod-2'); });
    const state = useFavoritesStore.getState();
    expect(state.favorites).toHaveLength(1);
    expect(state.favorites[0].variant).toBeUndefined();
  });

  it('toggleFavorite preserves variant on add', () => {
    act(() => { useFavoritesStore.getState().toggleFavorite('prod-1', variant); });
    expect(useFavoritesStore.getState().isFavorite('prod-1')).toBe(true);
    expect(useFavoritesStore.getState().getFavoriteVariant('prod-1')?.color_name).toBe('Verde Floresta');
  });

  it('toggleFavorite removes regardless of variant', () => {
    act(() => { useFavoritesStore.getState().addFavorite('prod-1', variant); });
    act(() => { useFavoritesStore.getState().toggleFavorite('prod-1'); });
    expect(useFavoritesStore.getState().isFavorite('prod-1')).toBe(false);
  });

  it('clearFavorites removes all including variants', () => {
    act(() => { useFavoritesStore.getState().addFavorite('prod-1', variant); });
    act(() => { useFavoritesStore.getState().addFavorite('prod-2', { color_name: 'Azul' }); });
    act(() => { useFavoritesStore.getState().clearFavorites(); });
    expect(useFavoritesStore.getState().favoriteCount).toBe(0);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')).toEqual([]);
  });
});

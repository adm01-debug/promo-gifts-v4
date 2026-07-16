import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFavoriteTemplate } from '../useFavoriteTemplate';

const KEY = 'magazine:favorite-template';

describe('useFavoriteTemplate', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('inicia como null quando storage está vazio', () => {
    const { result } = renderHook(() => useFavoriteTemplate());
    expect(result.current.favoriteId).toBeNull();
  });

  it('lê valor pré-existente do localStorage', () => {
    window.localStorage.setItem(KEY, 'editorial-vogue');
    const { result } = renderHook(() => useFavoriteTemplate());
    expect(result.current.favoriteId).toBe('editorial-vogue');
  });

  it('toggleFavorite marca id e persiste', () => {
    const { result } = renderHook(() => useFavoriteTemplate());
    act(() => result.current.toggleFavorite('editorial-vogue'));
    expect(result.current.favoriteId).toBe('editorial-vogue');
    expect(window.localStorage.getItem(KEY)).toBe('editorial-vogue');
  });

  it('toggleFavorite no mesmo id remove favorito', () => {
    window.localStorage.setItem(KEY, 'catalog-grid3x3');
    const { result } = renderHook(() => useFavoriteTemplate());
    act(() => result.current.toggleFavorite('catalog-grid3x3'));
    expect(result.current.favoriteId).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('toggleFavorite em id diferente substitui', () => {
    window.localStorage.setItem(KEY, 'a');
    const { result } = renderHook(() => useFavoriteTemplate());
    act(() => result.current.toggleFavorite('editorial-vogue'));
    expect(result.current.favoriteId).toBe('editorial-vogue');
  });

  it('clearFavorite limpa storage e estado', () => {
    window.localStorage.setItem(KEY, 'editorial-vogue');
    const { result } = renderHook(() => useFavoriteTemplate());
    act(() => result.current.clearFavorite());
    expect(result.current.favoriteId).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('rejeita valor gigante no storage', () => {
    window.localStorage.setItem(KEY, 'a'.repeat(200));
    const { result } = renderHook(() => useFavoriteTemplate());
    expect(result.current.favoriteId).toBeNull();
  });

  it('rejeita valor vazio no storage', () => {
    window.localStorage.setItem(KEY, '');
    const { result } = renderHook(() => useFavoriteTemplate());
    expect(result.current.favoriteId).toBeNull();
  });
});

import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useGenericFuzzySearch } from "@/hooks/common/useGenericFuzzySearch";

describe('useGenericFuzzySearch', () => {
  const mockItems = [
    { id: 1, name: 'Caneta Esferográfica', category: 'Escrita' },
    { id: 2, name: 'Caderno Espiral', category: 'Papelaria' },
    { id: 3, name: 'Lápis de Cor', category: 'Escrita' },
    { id: 4, name: 'Caneca Térmica', category: 'Utensílios' },
  ];

  it('returns all items when query is empty', () => {
    const { result } = renderHook(() => useGenericFuzzySearch(mockItems, '', ['name']));
    expect(result.current.results).toHaveLength(4);
    expect(result.current.hasSearch).toBe(false);
  });

  it('filters items correctly with an exact match', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(mockItems, 'Caneta', ['name'], { threshold: 0.1 }),
    );
    expect(result.current.results.some((r) => r.name === 'Caneta Esferográfica')).toBe(true);
    expect(result.current.results.every((r) => r.name !== 'Caderno Espiral')).toBe(true);
    expect(result.current.hasSearch).toBe(true);
  });

  it('performs fuzzy matching for typos', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(mockItems, 'Cantea', ['name'], { threshold: 0.4 }),
    );
    expect(result.current.results.some((r) => r.name === 'Caneta Esferográfica')).toBe(true);
  });

  it('respects minChars option', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(mockItems, 'Ca', ['name'], { minChars: 3 }),
    );
    expect(result.current.results).toHaveLength(4); // Not searching yet
    expect(result.current.hasSearch).toBe(false);
  });

  it('searches across multiple keys with weights', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(mockItems, 'Escrita', [
        { name: 'name', weight: 0.1 },
        { name: 'category', weight: 0.9 },
      ]),
    );
    // Should find items in "Escrita" category
    const writtenItems = result.current.results.filter((i) => i.category === 'Escrita');
    expect(writtenItems.length).toBeGreaterThanOrEqual(1);
  });

  it('limits results with maxResults option', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(mockItems, 'C', ['name'], { maxResults: 2 }),
    );
    expect(result.current.results).toHaveLength(2);
  });

  it('handles null/undefined query gracefully', () => {
    const { result } = renderHook(() =>
      // @ts-expect-error — testing null query for graceful handling
      useGenericFuzzySearch(mockItems, null, ['name']),
    );
    expect(result.current.results).toHaveLength(4);
    expect(result.current.hasSearch).toBe(false);
  });
});

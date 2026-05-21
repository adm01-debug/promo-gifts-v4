import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useCollections, type CollectionVariantInfo, type Collection } from '@/hooks/collections/useCollections';

// Mock AuthContext so useCollections can call useAuth
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: "test-user-id", email: "test@test.com" },
    session: { access_token: "mock-token" },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

const STORAGE_KEY = 'product-collections';

describe('useCollections — variant architecture', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const greenVariant: CollectionVariantInfo = {
    color_name: 'Verde Limão',
    color_hex: '#32CD32',
    variant_id: 'var-green',
    thumbnail: 'https://cdn.example.com/green.jpg',
  };

  const blueVariant: CollectionVariantInfo = {
    color_name: 'Azul Royal',
    color_hex: '#4169E1',
    variant_id: 'var-blue',
    thumbnail: 'https://cdn.example.com/blue.jpg',
  };

  // ── Creation ──

  it('creates a collection with empty productItems', () => {
    const { result } = renderHook(() => useCollections());
    let col: Collection;
    act(() => { col = result.current.createCollection('Test'); });
    expect(result.current.collections[0].productItems).toEqual([]);
    expect(result.current.collections[0].productIds).toEqual([]);
  });

  // ── Add with variant ──

  it('stores variant info when adding product to collection', () => {
    const { result } = renderHook(() => useCollections());
    let col: Collection;
    act(() => { col = result.current.createCollection('Kits'); });
    act(() => { result.current.addProductToCollection(result.current.collections[0].id, 'prod-1', greenVariant); });

    const collection = result.current.collections[0];
    expect(collection.productIds).toContain('prod-1');
    expect(collection.productItems).toHaveLength(1);
    expect(collection.productItems[0].productId).toBe('prod-1');
    expect(collection.productItems[0].variant?.color_name).toBe('Verde Limão');
    expect(collection.productItems[0].variant?.thumbnail).toBe('https://cdn.example.com/green.jpg');
  });

  it('stores product without variant when none is provided', () => {
    const { result } = renderHook(() => useCollections());
    act(() => { result.current.createCollection('No Variant'); });
    act(() => { result.current.addProductToCollection(result.current.collections[0].id, 'prod-2'); });

    const item = result.current.collections[0].productItems[0];
    expect(item.productId).toBe('prod-2');
    expect(item.variant).toBeUndefined();
  });

  // ── Deduplication ──

  it('does not add duplicate product to same collection', () => {
    const { result } = renderHook(() => useCollections());
    act(() => { result.current.createCollection('Dupes'); });
    const id = result.current.collections[0].id;
    act(() => { result.current.addProductToCollection(id, 'prod-1', greenVariant); });
    act(() => { result.current.addProductToCollection(id, 'prod-1', blueVariant); });

    expect(result.current.collections[0].productIds).toHaveLength(1);
    expect(result.current.collections[0].productItems).toHaveLength(1);
    // Keeps original variant
    expect(result.current.collections[0].productItems[0].variant?.color_name).toBe('Verde Limão');
  });

  // ── Remove ──

  it('removes product and its variant from collection', () => {
    const { result } = renderHook(() => useCollections());
    act(() => { result.current.createCollection('Remove Test'); });
    const id = result.current.collections[0].id;
    act(() => {
      result.current.addProductToCollection(id, 'prod-1', greenVariant);
      result.current.addProductToCollection(id, 'prod-2', blueVariant);
    });
    act(() => { result.current.removeProductFromCollection(id, 'prod-1'); });

    expect(result.current.collections[0].productIds).toEqual(['prod-2']);
    expect(result.current.collections[0].productItems).toHaveLength(1);
    expect(result.current.collections[0].productItems[0].productId).toBe('prod-2');
  });

  // ── Multiple collections ──

  it('addProductToMultipleCollections stores variant in all', () => {
    const { result } = renderHook(() => useCollections());
    act(() => {
      result.current.createCollection('Col A');
      result.current.createCollection('Col B');
    });
    const ids = result.current.collections.map(c => c.id);
    act(() => { result.current.addProductToMultipleCollections('prod-1', ids, greenVariant); });

    result.current.collections.forEach(col => {
      expect(col.productItems[0].variant?.color_name).toBe('Verde Limão');
    });
  });

  // ── Variant retrieval ──

  it('getCollectionProductVariant returns correct variant', () => {
    const { result } = renderHook(() => useCollections());
    act(() => { result.current.createCollection('Retrieve'); });
    const id = result.current.collections[0].id;
    act(() => { result.current.addProductToCollection(id, 'prod-1', greenVariant); });

    const v = result.current.getCollectionProductVariant(id, 'prod-1');
    expect(v?.color_hex).toBe('#32CD32');
    expect(v?.variant_id).toBe('var-green');
  });

  it('getCollectionProductVariant returns undefined for non-existent product', () => {
    const { result } = renderHook(() => useCollections());
    act(() => { result.current.createCollection('Empty'); });
    const id = result.current.collections[0].id;
    expect(result.current.getCollectionProductVariant(id, 'nope')).toBeUndefined();
  });

  // ── Product items list ──

  it('getCollectionProductItems returns all items with variants', () => {
    const { result } = renderHook(() => useCollections());
    act(() => { result.current.createCollection('Items'); });
    const id = result.current.collections[0].id;
    act(() => {
      result.current.addProductToCollection(id, 'prod-1', greenVariant);
      result.current.addProductToCollection(id, 'prod-2', blueVariant);
      result.current.addProductToCollection(id, 'prod-3');
    });

    const items = result.current.getCollectionProductItems(id);
    expect(items).toHaveLength(3);
    expect(items[0].variant?.color_name).toBe('Verde Limão');
    expect(items[1].variant?.color_name).toBe('Azul Royal');
    expect(items[2].variant).toBeUndefined();
  });

  // ── In-memory persistence (hook now uses Supabase, not localStorage) ──

  it('persists variant info in state after adding', () => {
    const { result } = renderHook(() => useCollections());
    act(() => { result.current.createCollection('Persist'); });
    const id = result.current.collections[0].id;
    act(() => { result.current.addProductToCollection(id, 'prod-1', greenVariant); });

    const col = result.current.collections[0];
    expect(col.productItems[0].variant?.color_hex).toBe('#32CD32');
    expect(col.productItems[0].variant?.thumbnail).toBe('https://cdn.example.com/green.jpg');
  });

  // ── Migration tests removed — hook now uses Supabase, migration is async ──

  // ── isProductInCollection ──

  it('isProductInCollection works with variant products', () => {
    const { result } = renderHook(() => useCollections());
    act(() => { result.current.createCollection('Check'); });
    const id = result.current.collections[0].id;
    act(() => { result.current.addProductToCollection(id, 'prod-1', greenVariant); });

    expect(result.current.isProductInCollection('prod-1', id)).toBe(true);
    expect(result.current.isProductInCollection('prod-999', id)).toBe(false);
  });

  // ── getProductCollections ──

  it('getProductCollections returns collections containing the product', () => {
    const { result } = renderHook(() => useCollections());
    act(() => {
      result.current.createCollection('A');
      result.current.createCollection('B');
    });
    act(() => {
      result.current.addProductToCollection(result.current.collections[0].id, 'prod-1', greenVariant);
      result.current.addProductToCollection(result.current.collections[1].id, 'prod-1', blueVariant);
    });

    const cols = result.current.getProductCollections('prod-1');
    expect(cols).toHaveLength(2);
  });

  // ── Delete collection ──

  it('deleteCollection removes collection with all variants', () => {
    const { result } = renderHook(() => useCollections());
    act(() => { result.current.createCollection('ToDelete'); });
    const id = result.current.collections[0].id;
    act(() => { result.current.addProductToCollection(id, 'prod-1', greenVariant); });
    act(() => { result.current.deleteCollection(id); });

    expect(result.current.collections).toHaveLength(0);
  });
});

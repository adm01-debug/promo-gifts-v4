import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { type Product } from '@/hooks/products';

import { logger } from '@/lib/logger';
const LEGACY_STORAGE_KEY = 'product-collections';

export interface CollectionVariantInfo {
  color_name?: string | null;
  color_hex?: string | null;
  size_code?: string | null;
  variant_id?: string | null;
  thumbnail?: string | null;
}

export interface CollectionProductItem {
  productId: string;
  variant?: CollectionVariantInfo;
  notes?: string;
  priceAtSave?: number | null;
  addedAt?: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  isFeatured: boolean;
  clientId?: string | null;
  clientName?: string | null;
  shareToken?: string | null;
  shareExpiresAt?: string | null;
  isPublic?: boolean;
  /** @deprecated Use productItems instead */
  productIds: string[];
  productItems: CollectionProductItem[];
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_COLORS = [
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#EF4444',
  '#6366F1',
  '#14B8A6',
];

const DEFAULT_ICONS = ['📁', '⭐', '🎁', '💼', '🎯', '💡', '🔥', '❤️'];

interface DbCollectionRow {
  id: string;
  name: string;
  description: string | null;
  icon_color: string | null;
  icon: string | null;
  is_featured: boolean | null;
  client_id: string | null;
  client_name: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  is_public: boolean | null;
  created_at: string;
  updated_at: string;
}

interface DbCollectionItemRow {
  product_id: string;
  color_name: string | null;
  color_hex: string | null;
  thumbnail_url: string | null;
  notes: string | null;
  price_at_save: number | null;
  created_at: string;
  collection_id: string;
  sort_order: number | null;
}

/** Convert DB rows to Collection interface */
function dbToCollection(row: DbCollectionRow, items: DbCollectionItemRow[]): Collection {
  const productItems: CollectionProductItem[] = items.map((item) => ({
    productId: item.product_id,
    variant:
      item.color_name || item.color_hex || item.thumbnail_url
        ? {
            color_name: item.color_name,
            color_hex: item.color_hex,
            thumbnail: item.thumbnail_url,
          }
        : undefined,
    notes: item.notes || undefined,
    priceAtSave: item.price_at_save ?? null,
    addedAt: item.created_at ?? null,
  }));

  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    color: row.icon_color || DEFAULT_COLORS[0],
    icon: row.icon || '📁',
    isFeatured: row.is_featured ?? false,
    clientId: row.client_id ?? null,
    clientName: row.client_name ?? null,
    shareToken: row.share_token ?? null,
    shareExpiresAt: row.share_expires_at ?? null,
    isPublic: row.is_public ?? false,
    productIds: productItems.map((i) => i.productId),
    productItems,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useAuth();

  // Load collections from DB
  const loadCollections = useCallback(async () => {
    if (!user?.id) return;

    const { data: colRows, error } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error loading collections:', error);
      setIsLoaded(true);
      return;
    }

    if (!colRows || colRows.length === 0) {
      setCollections([]);
      setIsLoaded(true);
      return;
    }

    // Load all items for user's collections
    const colIds = colRows.map((c) => c.id);
    const { data: itemRows } = await supabase
      .from('collection_items')
      .select('*')
      .in('collection_id', colIds)
      .order('sort_order', { ascending: true });

    const itemsByCollection = new Map<string, DbCollectionItemRow[]>();
    (itemRows || []).forEach((item) => {
      const list = itemsByCollection.get(item.collection_id) || [];
      list.push(item);
      itemsByCollection.set(item.collection_id, list);
    });

    const mapped = colRows.map((row) => dbToCollection(row, itemsByCollection.get(row.id) || []));

    setCollections(mapped);
    setIsLoaded(true);
  }, [user?.id]);

  // Migrate localStorage data on first load
  useEffect(() => {
    if (!user?.id) return;

    const migrateAndLoad = async () => {
      try {
        const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (stored) {
          const legacyCollections = JSON.parse(stored);
          if (Array.isArray(legacyCollections) && legacyCollections.length > 0) {
            // Check if user already has DB collections
            const { count } = await supabase
              .from('collections')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);

            if (count === 0) {
              // Migrate each collection
              for (const col of legacyCollections) {
                const { data: newCol } = await supabase
                  .from('collections')
                  .insert({
                    user_id: user.id,
                    name: col.name,
                    description: col.description || null,
                    is_featured: false,
                    icon_color: col.color || DEFAULT_COLORS[0],
                  })
                  .select()
                  .single();

                if (newCol) {
                  const items =
                    col.productItems ||
                    col.productIds?.map((id: string) => ({ productId: id })) ||
                    [];
                  if (items.length > 0) {
                    await supabase.from('collection_items').insert(
                      items.map(
                        (
                          item: { productId?: string; variant?: CollectionVariantInfo } | string,
                          idx: number,
                        ) => {
                          const isObj = typeof item === 'object';
                          return {
                            collection_id: newCol.id,
                            product_id: isObj ? item.productId : item,
                            color_name: isObj ? (item.variant?.color_name ?? null) : null,
                            color_hex: isObj ? (item.variant?.color_hex ?? null) : null,
                            thumbnail_url: isObj ? (item.variant?.thumbnail ?? null) : null,
                            sort_order: idx,
                          };
                        },
                      ),
                    );
                  }
                }
              }
              // Clear localStorage after successful migration
              localStorage.removeItem(LEGACY_STORAGE_KEY);
            } else {
              // User already has DB collections, just clear legacy
              localStorage.removeItem(LEGACY_STORAGE_KEY);
            }
          }
        }
      } catch (e) {
        logger.error('Error migrating collections:', e);
      }

      await loadCollections();
    };

    migrateAndLoad();
  }, [user?.id, loadCollections]);

  const createCollection = useCallback(
    (
      name: string,
      description?: string,
      color?: string,
      icon?: string,
      clientId?: string | null,
      clientName?: string | null,
    ): Collection => {
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      const chosenColor =
        color || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];

      const newCollection: Collection = {
        id: tempId,
        name,
        description,
        color: chosenColor,
        icon: icon || DEFAULT_ICONS[0],
        isFeatured: false,
        clientId: clientId ?? null,
        clientName: clientName ?? null,
        productIds: [],
        productItems: [],
        createdAt: now,
        updatedAt: now,
      };

      // Optimistic update
      setCollections((prev) => [newCollection, ...prev]);

      // Persist to DB
      if (user?.id) {
        supabase
          .from('collections')
          .insert({
            user_id: user.id,
            name,
            description: description || null,
            icon_color: chosenColor,
            icon: icon || DEFAULT_ICONS[0],
            client_id: clientId ?? null,
            client_name: clientName ?? null,
          })
          .select()
          .single()
          .then(({ data }) => {
            if (data) {
              setCollections((prev) =>
                prev.map((c) =>
                  c.id === tempId
                    ? { ...c, id: data.id, createdAt: data.created_at, updatedAt: data.updated_at }
                    : c,
                ),
              );
            }
          });
      }

      return newCollection;
    },
    [user?.id],
  );

  const updateCollection = useCallback(
    (id: string, updates: Partial<Omit<Collection, 'id' | 'createdAt'>>) => {
      setCollections((prev) =>
        prev.map((col) =>
          col.id === id ? { ...col, ...updates, updatedAt: new Date().toISOString() } : col,
        ),
      );

      // Persist
      const dbUpdates: TablesUpdate<'collections'> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.color !== undefined) dbUpdates.icon_color = updates.color;
      if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
      if (updates.isFeatured !== undefined) dbUpdates.is_featured = updates.isFeatured;
      if (updates.clientId !== undefined) dbUpdates.client_id = updates.clientId;
      if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
      if (updates.shareToken !== undefined) dbUpdates.share_token = updates.shareToken;
      if (updates.shareExpiresAt !== undefined) dbUpdates.share_expires_at = updates.shareExpiresAt;
      if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;

      if (Object.keys(dbUpdates).length > 0) {
        supabase.from('collections').update(dbUpdates).eq('id', id).then();
      }
    },
    [],
  );

  const deleteCollection = useCallback((id: string) => {
    setCollections((prev) => prev.filter((col) => col.id !== id));
    supabase.from('collections').delete().eq('id', id).then();
  }, []);

  const addProductToCollection = useCallback(
    (
      collectionId: string,
      productId: string,
      variant?: CollectionVariantInfo,
      priceAtSave?: number | null,
    ) => {
      setCollections((prev) =>
        prev.map((col) => {
          if (col.id !== collectionId) return col;
          if (col.productIds.includes(productId)) return col;
          return {
            ...col,
            productIds: [...col.productIds, productId],
            productItems: [...col.productItems, { productId, variant, priceAtSave: priceAtSave ?? null }],
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      supabase
        .from('collection_items')
        .insert({
          collection_id: collectionId,
          product_id: productId,
          color_name: variant?.color_name || null,
          color_hex: variant?.color_hex || null,
          thumbnail_url: variant?.thumbnail || null,
          price_at_save: priceAtSave ?? null,
          sort_order: 0,
        } as never)
        .then();
    },
    [],
  );

  const restoreFromTrash = useCallback(
    async (collectionId: string, productId: string) => {
      const { data: trashed } = await supabase
        .from('collection_items_trash' as never)
        .select('*')
        .eq('collection_id', collectionId)
        .eq('product_id', productId)
        .order('deleted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!trashed) return false;
      const t = trashed as Record<string, unknown>;
      await supabase.from('collection_items').insert({
        collection_id: collectionId,
        product_id: productId,
        color_name: t.color_name ?? null,
        color_hex: t.color_hex ?? null,
        thumbnail_url: t.thumbnail_url ?? null,
        notes: t.notes ?? null,
        price_at_save: t.price_at_save ?? null,
        sort_order: t.sort_order ?? 0,
      } as never);
      await supabase
        .from('collection_items_trash' as never)
        .delete()
        .eq('id', t.id as string);
      await loadCollections();
      return true;
    },
    [loadCollections],
  );

  const removeProductFromCollection = useCallback((collectionId: string, productId: string) => {
    setCollections((prev) =>
      prev.map((col) =>
        col.id === collectionId
          ? {
              ...col,
              productIds: col.productIds.filter((id) => id !== productId),
              productItems: col.productItems.filter((item) => item.productId !== productId),
              updatedAt: new Date().toISOString(),
            }
          : col,
      ),
    );

    supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('product_id', productId)
      .then();
  }, []);

  const addProductToMultipleCollections = useCallback(
    (productId: string, collectionIds: string[], variant?: CollectionVariantInfo, priceAtSave?: number | null) => {
      setCollections((prev) =>
        prev.map((col) => {
          if (collectionIds.includes(col.id) && !col.productIds.includes(productId)) {
            return {
              ...col,
              productIds: [...col.productIds, productId],
              productItems: [...col.productItems, { productId, variant, priceAtSave: priceAtSave ?? null }],
              updatedAt: new Date().toISOString(),
            };
          }
          return col;
        }),
      );

      // Persist all
      const inserts = collectionIds.map((colId) => ({
        collection_id: colId,
        product_id: productId,
        color_name: variant?.color_name || null,
        color_hex: variant?.color_hex || null,
        thumbnail_url: variant?.thumbnail || null,
        price_at_save: priceAtSave ?? null,
        sort_order: 0,
      }));

      supabase
        .from('collection_items')
        .upsert(inserts, {
          onConflict: 'collection_id,product_id,color_name',
        })
        .then();
    },
    [],
  );

  const getCollectionProductVariant = useCallback(
    (collectionId: string, productId: string): CollectionVariantInfo | undefined => {
      const collection = collections.find((col) => col.id === collectionId);
      if (!collection) return undefined;
      const item = collection.productItems.find((i) => i.productId === productId);
      return item?.variant;
    },
    [collections],
  );

  const getCollectionProductItems = useCallback(
    (collectionId: string): CollectionProductItem[] => {
      const collection = collections.find((col) => col.id === collectionId);
      return collection?.productItems ?? [];
    },
    [collections],
  );

  const getCollectionProductsFromMap = useCallback(
    (collectionId: string, getProductsByIds: (ids: string[]) => Product[]): Product[] => {
      const collection = collections.find((col) => col.id === collectionId);
      if (!collection) return [];
      return getProductsByIds(collection.productIds);
    },
    [collections],
  );

  const getProductCollections = useCallback(
    (productId: string): Collection[] =>
      collections.filter((col) => col.productIds.includes(productId)),
    [collections],
  );

  const isProductInCollection = useCallback(
    (productId: string, collectionId: string): boolean => {
      const collection = collections.find((col) => col.id === collectionId);
      return collection?.productIds.includes(productId) ?? false;
    },
    [collections],
  );

  const reorderProducts = useCallback((collectionId: string, orderedProductIds: string[]) => {
    setCollections((prev) =>
      prev.map((col) => {
        if (col.id !== collectionId) return col;
        const itemMap = new Map(col.productItems.map((item) => [item.productId, item]));
        const reordered = orderedProductIds
          .map((pid) => itemMap.get(pid))
          .filter(Boolean) as CollectionProductItem[];
        return {
          ...col,
          productIds: reordered.map((i) => i.productId),
          productItems: reordered,
          updatedAt: new Date().toISOString(),
        };
      }),
    );

    // Persist sort_order to DB
    orderedProductIds.forEach((pid, idx) => {
      supabase
        .from('collection_items')
        .update({ sort_order: idx })
        .eq('collection_id', collectionId)
        .eq('product_id', pid)
        .then();
    });
  }, []);

  const updateProductNotes = useCallback(
    (collectionId: string, productId: string, notes: string) => {
      setCollections((prev) =>
        prev.map((col) => {
          if (col.id !== collectionId) return col;
          return {
            ...col,
            productItems: col.productItems.map((item) =>
              item.productId === productId ? { ...item, notes } : item,
            ),
          };
        }),
      );

      supabase
        .from('collection_items')
        .update({ notes })
        .eq('collection_id', collectionId)
        .eq('product_id', productId)
        .then();
    },
    [],
  );

  return {
    collections,
    isLoaded,
    createCollection,
    updateCollection,
    deleteCollection,
    addProductToCollection,
    removeProductFromCollection,
    addProductToMultipleCollections,
    reorderProducts,
    updateProductNotes,
    restoreFromTrash,
    getCollectionProductsFromMap,
    getCollectionProductItems,
    getCollectionProductVariant,
    getProductCollections,
    isProductInCollection,
    defaultColors: DEFAULT_COLORS,
    defaultIcons: DEFAULT_ICONS,
  };
}

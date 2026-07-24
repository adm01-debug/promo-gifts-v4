import { createContext, useContext, type ReactNode, useCallback, useMemo } from 'react';
import {
  useCollections,
  type Collection,
  type CollectionVariantInfo,
  type CollectionProductItem,
} from '@/hooks/collections';
import { useProductsContext } from '@/contexts/ProductsContext';
import type { Product } from '@/types/product-catalog';

interface CollectionsContextType {
  collections: Collection[];
  isLoaded: boolean;
  createCollection: (
    name: string,
    description?: string,
    color?: string,
    icon?: string,
    clientId?: string | null,
    clientName?: string | null,
  ) => Collection;
  updateCollection: (id: string, updates: Partial<Omit<Collection, 'createdAt' | 'id'>>) => void;
  deleteCollection: (id: string) => void;
  addProductToCollection: (
    collectionId: string,
    productId: string,
    variant?: CollectionVariantInfo,
    priceAtSave?: number | null,
  ) => void;
  removeProductFromCollection: (collectionId: string, productId: string) => void;
  addProductToMultipleCollections: (
    productId: string,
    collectionIds: string[],
    variant?: CollectionVariantInfo,
    priceAtSave?: number | null,
  ) => void;
  restoreFromTrash: (collectionId: string, productId: string) => Promise<boolean>;
  reorderProducts: (collectionId: string, orderedProductIds: string[]) => void;
  updateProductNotes: (collectionId: string, productId: string, notes: string) => void;
  getCollectionProducts: (collectionId: string) => Product[];
  getCollectionProductItems: (collectionId: string) => CollectionProductItem[];
  getCollectionProductVariant: (
    collectionId: string,
    productId: string,
  ) => CollectionVariantInfo | undefined;
  getProductCollections: (productId: string) => Collection[];
  isProductInCollection: (productId: string, collectionId: string) => boolean;
  defaultColors: string[];
  defaultIcons: string[];
}

const CollectionsContext = createContext<CollectionsContextType | undefined>(undefined);

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const collectionsHook = useCollections();
  const { getProductsByIds } = useProductsContext();

  const getCollectionProducts = useCallback(
    (collectionId: string): Product[] =>
      collectionsHook.getCollectionProductsFromMap(collectionId, getProductsByIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionsHook.getCollectionProductsFromMap, getProductsByIds],
  );

  const value = useMemo(
    () => ({ ...collectionsHook, getCollectionProducts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionsHook, getCollectionProducts],
  );

  return <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>;
}

export function useCollectionsContext() {
  const context = useContext(CollectionsContext);
  if (context === undefined) {
    throw new Error('useCollectionsContext must be used within a CollectionsProvider');
  }
  return context;
}

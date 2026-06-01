/**
 * Hook para sincronizar coleções com o BD (Supabase)
 * Tabelas: collections, collection_products
 *
 * FIX 2026-06-01:
 *   - Adicionado SELECT policy no DB (migration 20260601180000)
 *   - Interface atualizada com campos reais (is_deleted, user_id, etc.)
 *   - Filtro corrigido: .eq('is_deleted', false) em vez de .eq('is_active', true)
 *     (coluna is_active não existe na tabela)
 *   - collection_products: ORDER e INSERT corrigidos para 'display_order'
 *     (coluna 'sort_order' não existe em collection_products)
 *
 * FIX 2026-06-01 (CRASH FIX — name clash):
 *   - useCollections() renomeado para useExternalCollectionsManager() para evitar
 *     conflito com useCollections() de useCollections.ts no barrel export index.ts.
 *     O clash fazia o bundle resolver para o shape errado ({ isLoading } em vez de
 *     { isLoaded }) → externalCollections = undefined → .map() crash no CollectionsPage.
 *   - Adicionado useExternalCollectionProductCounts() que estava sendo importado
 *     em useCollectionsPageState mas não existia neste arquivo.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

// ─── Interfaces alinhadas com schema real do DB ───────────────────────────────

export interface ExternalCollection {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  is_featured: boolean;
  icon_color?: string | null;
  icon?: string | null;
  created_at: string;
  updated_at: string;
  client_id?: string | null;
  client_name?: string | null;
  share_token?: string | null;
  share_expires_at?: string | null;
  is_public: boolean;
  is_deleted: boolean;
}

export interface ExternalCollectionProduct {
  id: string;
  collection_id: string;
  product_id: string;
  display_order: number;  // FIX: era sort_order — campo real é display_order
  created_at: string;
}

type NewCollection = Omit<ExternalCollection, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'is_deleted'>;
type UpdateCollection = Partial<NewCollection>;

const COLLECTIONS_QUERY_KEY = ['external-collections'];
const COLLECTION_PRODUCTS_QUERY_KEY = (id: string) => ['external-collection-products', id];

export function useExternalCollections() {
  return useQuery({
    queryKey: COLLECTIONS_QUERY_KEY,
    queryFn: async () => {
      // FIX: era .eq('is_active', true) — coluna is_active não existe
      // Correto: filtrar por is_deleted=false (campo real, NOT NULL, DEFAULT false)
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('is_deleted', false)
        .order('name');

      if (error) throw new Error(sanitizeError(error));
      return (data as ExternalCollection[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useExternalCollection(id: string | undefined) {
  return useQuery({
    queryKey: ['external-collection', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(sanitizeError(error));
      return data as ExternalCollection | null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExternalCollectionProducts(collectionId: string | undefined) {
  return useQuery({
    queryKey: COLLECTION_PRODUCTS_QUERY_KEY(collectionId || ''),
    queryFn: async () => {
      if (!collectionId) return [];
      const { data, error } = await supabase
        .from('collection_products')
        .select('*')
        .eq('collection_id', collectionId)
        .order('display_order');  // FIX: era sort_order — campo real é display_order

      if (error) throw new Error(sanitizeError(error));
      return (data as ExternalCollectionProduct[]) || [];
    },
    enabled: !!collectionId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Retorna um mapa de { collectionId → productCount } para múltiplas coleções.
 * Usado em useCollectionsPageState para exibir contagens nas listagem externos.
 * Faz uma única query em collection_products e agrega no cliente para evitar
 * N+1 queries.
 */
export function useExternalCollectionProductCounts(collectionIds: string[]) {
  return useQuery({
    queryKey: ['external-collection-product-counts', collectionIds],
    queryFn: async () => {
      if (!collectionIds.length) return {} as Record<string, number>;

      const { data, error } = await supabase
        .from('collection_products')
        .select('collection_id')
        .in('collection_id', collectionIds);

      if (error) throw new Error(sanitizeError(error));

      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        counts[row.collection_id] = (counts[row.collection_id] || 0) + 1;
      });
      return counts;
    },
    enabled: collectionIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExternalCollectionMutations() {
  const queryClient = useQueryClient();

  const createCollection = useMutation({
    mutationFn: async (collection: NewCollection) => {
      const { data, error } = await supabase
        .from('collections')
        .insert(collection)
        .select()
        .single();

      if (error) throw new Error(sanitizeError(error));
      return data as ExternalCollection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      toast.success('Coleção criada com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao criar coleção: ${error.message}`);
    },
  });

  const updateCollection = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateCollection }) => {
      const { data, error } = await supabase
        .from('collections')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(sanitizeError(error));
      return data as ExternalCollection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      toast.success('Coleção atualizada com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar coleção: ${error.message}`);
    },
  });

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete via is_deleted=true em vez de DELETE físico
      // preserva integridade referencial com collection_products
      const { error } = await supabase
        .from('collections')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw new Error(sanitizeError(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      toast.success('Coleção excluída com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir coleção: ${error.message}`);
    },
  });

  const addProductToCollection = useMutation({
    mutationFn: async ({
      collectionId,
      productId,
      sortOrder,
    }: {
      collectionId: string;
      productId: string;
      sortOrder?: number;
    }) => {
      const { data, error } = await supabase
        .from('collection_products')
        // FIX: era {sort_order} — campo real é display_order
        .insert({ collection_id: collectionId, product_id: productId, display_order: sortOrder ?? 0 })
        .select()
        .single();

      if (error) throw new Error(sanitizeError(error));
      return data as ExternalCollectionProduct;
    },
    onSuccess: (_, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: COLLECTION_PRODUCTS_QUERY_KEY(collectionId) });
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      toast.success('Produto adicionado à coleção');
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar produto: ${error.message}`);
    },
  });

  const removeProductFromCollection = useMutation({
    mutationFn: async ({ collectionId, productId }: { collectionId: string; productId: string }) => {
      const { error } = await supabase
        .from('collection_products')
        .delete()
        .eq('collection_id', collectionId)
        .eq('product_id', productId);

      if (error) throw new Error(sanitizeError(error));
    },
    onSuccess: (_, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: COLLECTION_PRODUCTS_QUERY_KEY(collectionId) });
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      toast.success('Produto removido da coleção');
    },
    onError: (error) => {
      toast.error(`Erro ao remover produto: ${error.message}`);
    },
  });

  return {
    createCollection: createCollection.mutateAsync,
    updateCollection: updateCollection.mutateAsync,
    deleteCollection: deleteCollection.mutateAsync,
    addProductToCollection: addProductToCollection.mutateAsync,
    removeProductFromCollection: removeProductFromCollection.mutateAsync,
    isCreating: createCollection.isPending,
    isUpdating: updateCollection.isPending,
    isDeleting: deleteCollection.isPending,
  };
}

/**
 * Hook composto para gerenciar coleções externas — agrupa query + mutations.
 *
 * IMPORTANTE: este hook se chamava useCollections() antes do fix de 2026-06-01.
 * Foi renomeado para useExternalCollectionsManager() para evitar conflito de nome
 * com useCollections() em useCollections.ts — ambos eram exportados pelo index.ts
 * via export*, causando um name clash que fazia o CollectionsPage crashar com
 * TypeError: Cannot read properties of undefined (reading 'map').
 */
export function useExternalCollectionsManager() {
  const { data: collections = [], isLoading, error, refetch } = useExternalCollections();
  const mutations = useExternalCollectionMutations();

  return {
    collections,
    isLoading,
    error,
    refetch,
    ...mutations,
  };
}

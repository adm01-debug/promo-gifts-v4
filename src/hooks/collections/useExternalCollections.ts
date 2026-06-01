/**
 * Hook para sincronizar coleções com o BD externo (Promobrind)
 * Tabelas: collections, collection_products
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

// Interface que reflete a estrutura do BD externo
interface ExternalCollection {
  id: string;
  name: string;
  description?: string | null;
  slug?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  share_token?: string | null;
  cover_image_url?: string | null;
  product_count?: number;
  created_at?: string;
  updated_at?: string;
}

interface ExternalCollectionProduct {
  id: string;
  collection_id: string;
  product_id: string;
  sort_order?: number;
  added_at?: string;
}

type NewCollection = Omit<ExternalCollection, 'id' | 'created_at' | 'updated_at'>;
type UpdateCollection = Partial<NewCollection>;

const COLLECTIONS_QUERY_KEY = ['external-collections'];
const COLLECTION_PRODUCTS_QUERY_KEY = (id: string) => ['external-collection-products', id];

export function useExternalCollections() {
  return useQuery({
    queryKey: COLLECTIONS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('is_active', true)
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
        .order('sort_order');

      if (error) throw new Error(sanitizeError(error));
      return (data as ExternalCollectionProduct[]) || [];
    },
    enabled: !!collectionId,
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
      const { error } = await supabase
        .from('collections')
        .delete()
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
    mutationFn: async ({ collectionId, productId, sortOrder }: { collectionId: string; productId: string; sortOrder?: number }) => {
      const { data, error } = await supabase
        .from('collection_products')
        .insert({ collection_id: collectionId, product_id: productId, sort_order: sortOrder })
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

export function useCollections() {
  const { collections, isLoading, error, refetch } = useExternalCollections();
  const mutations = useExternalCollectionMutations();

  return {
    collections,
    isLoading,
    error,
    refetch,
    ...mutations,
  };
}

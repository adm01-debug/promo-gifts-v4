/**
 * Hook para sincronizar coleções com o BD externo (Promobrind)
 * Tabelas: collections, collection_products
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

// Interface que reflete a estrutura do BD externo
export interface ExternalCollection {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  banner_url?: string | null;
  color?: string | null;
  icon?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  display_order?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalCollectionProduct {
  id: string;
  collection_id: string;
  product_id: string;
  display_order?: number;
  created_at?: string;
}

const QUERY_KEY = 'external-collections';

/**
 * Busca coleções do BD externo
 */
export function useExternalCollections() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .limit(100);
      
      if (error) {
        if (error.message?.includes('410')) return [];
        throw error;
      }
      return (data || []).filter((c) => c.is_active !== false);
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Busca produtos de uma coleção específica
 */
export function useExternalCollectionProducts(collectionId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, 'products', collectionId],
    queryFn: async () => {
      if (!collectionId) return [];

      const { data, error } = await supabase
        .from('collection_products')
        .select('*')
        .eq('collection_id', collectionId)
        .order('display_order', { ascending: true })
        .limit(500);
      
      if (error) {
        if (error.message?.includes('410')) return [];
        throw error;
      }
      return data || [];
    },
    enabled: !!collectionId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Busca contagem de produtos para todas as coleções externas
 */
export function useExternalCollectionProductCounts(collectionIds: string[]) {
  return useQuery({
    queryKey: [QUERY_KEY, 'product-counts', collectionIds],
    queryFn: async () => {
      if (collectionIds.length === 0) return new Map<string, number>();

      const { data, error } = await supabase
        .from('collection_products')
        .select('collection_id, product_id')
        .in('collection_id', collectionIds)
        .limit(5000);
      
      if (error) {
        if (error.message?.includes('410')) return new Map<string, number>();
        throw error;
      }

      const counts = new Map<string, number>();
      for (const r of data || []) {
        counts.set(r.collection_id, (counts.get(r.collection_id) || 0) + 1);
      }
      return counts;
    },
    enabled: collectionIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutations para gerenciar coleções
 */
export function useExternalCollectionMutations() {
  const queryClient = useQueryClient();

  const createCollection = useMutation({
    mutationFn: async (data: Partial<ExternalCollection>) => {
      const slug =
        data.name
          ?.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '') || `col-${Date.now()}`;
      const { data: inserted, error } = await supabase
        .from('collections')
        .insert({
          ...data,
          slug,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return inserted as ExternalCollection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Coleção criada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar coleção', { description: sanitizeError(error) });
    },
  });

  const updateCollection = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ExternalCollection> }) => {
      const { data: updated, error } = await supabase
        .from('collections')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated as ExternalCollection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Coleção atualizada!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar', { description: sanitizeError(error) });
    },
  });

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Coleção excluída!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir', { description: sanitizeError(error) });
    },
  });

  const addProductToCollection = useMutation({
    mutationFn: async ({
      collectionId,
      productId,
    }: {
      collectionId: string;
      productId: string;
    }) => {
      const { data: inserted, error } = await supabase
        .from('collection_products')
        .insert({
          collection_id: collectionId,
          product_id: productId,
        })
        .select()
        .single();
      if (error) throw error;
      return inserted as ExternalCollectionProduct;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'products', variables.collectionId] });
      toast.success('Produto adicionado à coleção!');
    },
    onError: (error) => {
      toast.error('Operação não pôde ser concluída', { description: sanitizeError(error) });
    },
  });

  const removeProductFromCollection = useMutation({
    mutationFn: async (relationId: string) => {
      const { error } = await supabase
        .from('collection_products')
        .delete()
        .eq('id', relationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Produto removido da coleção!');
    },
    onError: (error) => {
      toast.error('Operação não pôde ser concluída', { description: sanitizeError(error) });
    },
  });

  return {
    createCollection,
    updateCollection,
    deleteCollection,
    addProductToCollection,
    removeProductFromCollection,
  };
}

/**
 * Hook combinado para usar coleções do BD externo
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

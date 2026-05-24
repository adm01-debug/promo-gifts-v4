/**
 * Hook para sincronizar coleções com o BD externo (Promobrind)
 * Tabelas: collections, collection_products
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeExternalDb, invokeExternalDbSingle } from '@/lib/external-db';
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
      // Buscar todas as coleções sem filtrar por is_active (coluna pode não existir)
      const result = await invokeExternalDb<ExternalCollection>({
        table: 'collections',
        operation: 'select',
        select: '*', // Buscar todos os campos disponíveis
        limit: 100,
      });
      // Filtrar no cliente se o campo existir
      return result.records.filter((c) => c.is_active !== false);
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

      const result = await invokeExternalDb<ExternalCollectionProduct>({
        table: 'collection_products',
        operation: 'select',
        filters: { collection_id: collectionId },
        orderBy: { column: 'display_order', ascending: true },
        limit: 500,
      });
      return result.records;
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

      const result = await invokeExternalDb<ExternalCollectionProduct>({
        table: 'collection_products',
        operation: 'select',
        select: 'collection_id,product_id',
        filters: { collection_id: collectionIds },
        limit: 5000,
      });

      const counts = new Map<string, number>();
      for (const r of result.records) {
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
      return invokeExternalDbSingle<ExternalCollection>({
        table: 'collections',
        operation: 'insert',
        data: {
          ...data,
          slug,
          is_active: true,
        },
      });
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
      return invokeExternalDbSingle<ExternalCollection>({
        table: 'collections',
        operation: 'update',
        id,
        data,
      });
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
      return invokeExternalDb({
        table: 'collections',
        operation: 'delete',
        id,
      });
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
      return invokeExternalDbSingle<ExternalCollectionProduct>({
        table: 'collection_products',
        operation: 'insert',
        data: {
          collection_id: collectionId,
          product_id: productId,
        },
      });
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
      return invokeExternalDb({
        table: 'collection_products',
        operation: 'delete',
        id: relationId,
      });
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

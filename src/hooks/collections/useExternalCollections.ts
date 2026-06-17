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
import { untypedFrom } from '@/lib/supabase-untyped';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

// Interface que reflete a estrutura do BD externo
export interface ExternalCollection {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  icon_color?: string | null;
  is_deleted?: boolean;
  is_featured?: boolean;
  is_public?: boolean;
  client_id?: string | null;
  client_name?: string | null;
  share_token?: string | null;
  share_expires_at?: string | null;
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
      // is_deleted é a coluna real de soft-delete (is_active não existe — ver types.ts).
      const { data, error } = await untypedFrom('collections')
        .select('*')
        .eq('is_deleted', false)
        .limit(100);

      if (error) {
        const isGone = error.message?.includes('410') || error.message?.includes('Gone');
        if (isGone) {
          const { reportSilentEmpty } = await import('@/lib/external-db/silent-empty-report');
          reportSilentEmpty({
            reason: 'gone_410',
            table: 'collections',
            operation: 'select',
            message: error.message,
          });
          return [];
        }
        throw error;
      }

      return data ?? [];
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

      const { data, error } = await untypedFrom('collection_products')
        .select('*')
        .eq('collection_id', collectionId)
        .order('display_order', { ascending: true })
        .limit(500);

      if (error) {
        if (error.message?.includes('410') || error.message?.includes('Gone')) return [];
        throw error;
      }
      return data ?? [];
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

      const { data, error } = await untypedFrom('collection_products')
        .select('collection_id, product_id')
        .in('collection_id', collectionIds)
        .limit(5000);

      if (error) {
        if (error.message?.includes('410')) return new Map<string, number>();
        throw error;
      }

      const counts = new Map<string, number>();
      for (const r of (data ?? []) as unknown as { collection_id: string; product_id: string }[]) {
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
      const { data: inserted, error } = await untypedFrom('collections')
        .insert({
          ...data,
          is_deleted: false,
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
      const { data: updated, error } = await untypedFrom('collections')
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
      const { error } = await untypedFrom('collections').delete().eq('id', id);
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
      const { data: inserted, error } = await untypedFrom('collection_products')
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
      const { error } = await untypedFrom('collection_products').delete().eq('id', relationId);
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

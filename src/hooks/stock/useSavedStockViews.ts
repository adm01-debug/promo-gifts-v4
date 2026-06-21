/**
 * useSavedStockViews — Gerencia views salvas do painel EMA.
 * Onda 3 / Melhoria 18.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/ui';

export interface SavedStockView {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, unknown>;
  description: string | null;
  is_pinned: boolean;
  use_count: number;
  created_at: string;
}

const TABLE = 'saved_stock_views';

export function useSavedStockViews() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const client = supabase as unknown as {
    from: (n: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          order: (
            k: string,
            o: { ascending: boolean },
          ) => Promise<{
            data: SavedStockView[] | null;
            error: Error | null;
          }>;
        };
      };
      insert: (r: Partial<SavedStockView>) => Promise<{ error: Error | null }>;
      delete: () => { eq: (k: string, v: string) => Promise<{ error: Error | null }> };
      update: (r: Partial<SavedStockView>) => {
        eq: (k: string, v: string) => Promise<{ error: Error | null }>;
      };
    };
    auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
  };

  const viewsQuery = useQuery({
    queryKey: ['saved-stock-views'],
    staleTime: 60_000,
    queryFn: async (): Promise<SavedStockView[]> => {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) return [];
      const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('user_id', user.id)
        .order('is_pinned', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveView = useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: Record<string, unknown> }) => {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { error } = await client.from(TABLE).insert({
        user_id: user.id,
        name,
        filters: filters as unknown as SavedStockView['filters'],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['saved-stock-views'] });
      toast({ title: '💾 View salva!' });
    },
    onError: (err) =>
      toast({
        title: 'Erro ao salvar',
        description: (err as Error).message,
        variant: 'destructive',
      }),
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-stock-views'] });
    },
  });

  return {
    views: viewsQuery.data ?? [],
    isLoading: viewsQuery.isLoading,
    saveView,
    deleteView,
  };
}

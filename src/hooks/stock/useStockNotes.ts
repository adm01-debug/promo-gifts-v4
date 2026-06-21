/**
 * useStockNotes — Comentários inline por variante (stock_notes).
 * Onda 2 / Melhoria 12.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/ui';

export interface StockNote {
  id: string;
  variant_id: string;
  supplier_id: string | null;
  created_by: string;
  note: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export function useStockNotes(variantId: string | null) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const client = supabase as unknown as {
    from: (n: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (k: string, o: { ascending: boolean }) => Promise<{
            data: StockNote[] | null; error: Error | null;
          }>;
        };
      };
      insert: (row: Partial<StockNote>) => Promise<{ error: Error | null }>;
      delete: () => { eq: (k: string, v: string) => Promise<{ error: Error | null }> };
    };
  };

  const notesQuery = useQuery({
    queryKey: ['stock-notes', variantId],
    enabled: !!variantId,
    staleTime: 60_000,
    queryFn: async (): Promise<StockNote[]> => {
      if (!variantId) return [];
      const { data, error } = await client
        .from('stock_notes')
        .select('*')
        .eq('variant_id', variantId)
        .order('is_pinned', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addNote = useMutation({
    mutationFn: async ({ note, supplierId }: { note: string; supplierId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { error } = await client.from('stock_notes').insert({
        variant_id: variantId!,
        supplier_id: supplierId ?? null,
        created_by: user.id,
        note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock-notes', variantId] });
      toast({ title: '📝 Nota adicionada' });
    },
    onError: (err) => toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' }),
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await client.from('stock_notes').delete().eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stock-notes', variantId] }),
  });

  return { notes: notesQuery.data ?? [], isLoading: notesQuery.isLoading, addNote, deleteNote };
}

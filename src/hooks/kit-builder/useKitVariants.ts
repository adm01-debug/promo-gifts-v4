/**
 * useKitVariants — gerencia variantes (P/M/G) de um Kit Master
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import type { KitState } from '@/lib/kit-builder';

export interface KitVariantRow {
  id: string;
  kit_master_id: string;
  label: string;
  sort_order: number;
  box_data: Record<string, unknown> | null;
  items_data: Record<string, unknown>[];
  personalization_data: Record<string, unknown>;
  kit_quantity: number;
  total_price: number;
  created_at: string;
  updated_at: string;
}

export function useKitVariants(kitMasterId: string | undefined) {
  const qc = useQueryClient();
  const key = ['kit-variants', kitMasterId] as const;

  const { data: variants = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!kitMasterId) return [];
      const { data, error } = await supabase
        .from('kit_variants')
        .select('*')
        .eq('kit_master_id', kitMasterId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as KitVariantRow[];
    },
    enabled: !!kitMasterId,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: async ({
      label,
      kitState,
      kitQuantity,
    }: {
      label: string;
      kitState: KitState;
      kitQuantity: number;
    }) => {
      if (!kitMasterId) throw new Error('Kit master não definido');
      const payload = {
        kit_master_id: kitMasterId,
        label,
        sort_order: variants.length,
        box_data: kitState.box ? structuredClone(kitState.box) : null,
        items_data: structuredClone(kitState.items),
        personalization_data: structuredClone(kitState.personalization),
        kit_quantity: kitQuantity,
        total_price: kitState.totalPrice,
      };
      const { data, error } = await supabase.from('kit_variants').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success('Variante criada');
    },
    onError: (e: Error) => toast.error('Operação falhou', { description: sanitizeError(e) }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('kit_variants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success('Variante removida');
    },
  });

  return {
    variants,
    isLoading,
    createVariant: create.mutateAsync,
    removeVariant: remove.mutateAsync,
    isCreating: create.isPending,
  };
}

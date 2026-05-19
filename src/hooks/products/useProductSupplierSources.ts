/**
 * Hook for managing product supplier sources via external DB bridge.
 * Uses variant_supplier_sources table in the external catalog DB.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SupplierSource {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_sku: string | null;
  cost_price: number;
  sale_price: number;
  lead_time_days: number | null;
  stock_quantity: number;
  min_order_quantity: number;
  is_preferred: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SupplierSourceInput = Omit<SupplierSource, 'id' | 'created_at' | 'updated_at'>;

const BRIDGE_TABLE = 'variant_supplier_sources';

async function bridgeInvoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('external-db-bridge', { body });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Erro na operação');
  return data;
}

export function useProductSupplierSources(productId?: string) {
  const [sources, setSources] = useState<SupplierSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSources = useCallback(async () => {
    if (!productId) {
      setSources([]);
      return;
    }
    setIsLoading(true);
    try {
      const result = await bridgeInvoke({
        table: BRIDGE_TABLE,
        operation: 'select',
        filters: { product_id: productId },
        limit: 100,
        orderBy: { column: 'is_preferred', ascending: false },
      });
      const records = (result.data?.records || []) as SupplierSource[];
      // Secondary sort by sale_price
      records.sort((a, b) => {
        if (a.is_preferred !== b.is_preferred) return a.is_preferred ? -1 : 1;
        return (a.sale_price ?? 0) - (b.sale_price ?? 0);
      });
      setSources(records);
    } catch (err: unknown) {
      console.error('Error fetching supplier sources:', err);
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const addSource = useCallback(
    async (input: SupplierSourceInput) => {
      try {
        await bridgeInvoke({
          table: BRIDGE_TABLE,
          operation: 'insert',
          data: input,
        });
        toast.success('Fonte de fornecimento adicionada');
        await fetchSources();
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (!msg.includes('duplicate') && !msg.includes('23505')) {
          toast.error('Erro ao adicionar fonte');
        }
        return false;
      }
    },
    [fetchSources],
  );

  const updateSource = useCallback(
    async (id: string, updates: Partial<SupplierSourceInput>) => {
      try {
        await bridgeInvoke({
          table: BRIDGE_TABLE,
          operation: 'update',
          id,
          data: updates,
        });
        toast.success('Fonte atualizada');
        await fetchSources();
        return true;
      } catch {
        toast.error('Erro ao atualizar fonte');
        return false;
      }
    },
    [fetchSources],
  );

  const removeSource = useCallback(
    async (id: string) => {
      try {
        await bridgeInvoke({
          table: BRIDGE_TABLE,
          operation: 'delete',
          id,
        });
        toast.success('Fonte removida');
        await fetchSources();
        return true;
      } catch {
        toast.error('Erro ao remover fonte');
        return false;
      }
    },
    [fetchSources],
  );

  const setPreferred = useCallback(
    async (id: string) => {
      if (!productId) return false;
      try {
        // First unset all preferred for this product
        for (const src of sources) {
          if (src.is_preferred && src.id !== id) {
            await bridgeInvoke({
              table: BRIDGE_TABLE,
              operation: 'update',
              id: src.id,
              data: { is_preferred: false },
            });
          }
        }
        // Set new preferred
        await bridgeInvoke({
          table: BRIDGE_TABLE,
          operation: 'update',
          id,
          data: { is_preferred: true },
        });
        toast.success('Fornecedor preferencial atualizado');
        await fetchSources();
        return true;
      } catch {
        toast.error('Erro ao definir preferencial');
        return false;
      }
    },
    [productId, sources, fetchSources],
  );

  return {
    sources,
    isLoading,
    addSource,
    updateSource,
    removeSource,
    setPreferred,
    refetch: fetchSources,
  };
}

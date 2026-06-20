/**
 * Hook for managing product supplier sources via external DB bridge.
 * FIX-BRIDGE-01 (2026-06-01): migrated from supabase.functions.invoke to dbInvoke.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { dbInvoke } from '@/lib/db/postgrest';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
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
  const op = (body.operation as string) || 'select';
  if (op === 'select') {
    const result = await dbInvoke({
      table: body.table as string,
      operation: 'select',
      select: body.select as string | undefined,
      filters: body.filters as Record<string, unknown> | undefined,
      orderBy: body.orderBy as { column: string; ascending?: boolean } | undefined,
      limit: body.limit as number | undefined,
      offset: body.offset as number | undefined,
    });
    return { success: true, data: { records: result.records, count: result.count } };
  }
  const table = body.table as string;
  if (op === 'insert') {
    const { data, error } = await untypedFrom(table)
      .insert(body.data as Record<string, unknown>)
      .select();
    if (error) throw new Error(error.message);
    return { success: true, data: { records: data ?? [], count: (data ?? []).length } };
  }
  if (op === 'update') {
    let q = untypedFrom(table).update(body.data as Record<string, unknown>);
    if (body.id)
      q = (q as unknown as { eq: (c: string, v: unknown) => typeof q }).eq(
        'id',
        body.id,
      ) as unknown as typeof q;
    const { data, error } = await (
      q as unknown as {
        select: () => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      }
    ).select();
    if (error) throw new Error(error.message);
    return { success: true, data: { records: data ?? [], count: (data ?? []).length } };
  }
  if (op === 'delete') {
    const { error } = await untypedFrom(table)
      .delete()
      .eq('id', body.id as string);
    if (error) throw new Error(error.message);
    return { success: true, data: { records: [], count: 0 } };
  }
  throw new Error(`bridgeInvoke: unsupported operation '${op}'`);
}

export function useProductSupplierSources(productId?: string) {
  const [sources, setSources] = useState<SupplierSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Supersede guard: when productId changes mid-flight, a stale response for the
  // previous product must not overwrite the current one (wrong-entity race).
  const fetchTokenRef = useRef(0);

  const fetchSources = useCallback(async () => {
    if (!productId) {
      setSources([]);
      return;
    }
    const token = ++fetchTokenRef.current;
    setIsLoading(true);
    try {
      const result = await bridgeInvoke({
        table: BRIDGE_TABLE,
        operation: 'select',
        filters: { product_id: productId },
        limit: 100,
        orderBy: { column: 'is_preferred', ascending: false },
      });
      const records = (result.data?.records ?? []) as SupplierSource[];
      records.sort((a, b) => {
        if (a.is_preferred !== b.is_preferred) return a.is_preferred ? -1 : 1;
        return (a.sale_price ?? 0) - (b.sale_price ?? 0);
      });
      if (token === fetchTokenRef.current) setSources(records);
    } catch (err: unknown) {
      logger.error('Error fetching supplier sources:', err);
    } finally {
      if (token === fetchTokenRef.current) setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const addSource = useCallback(
    async (input: SupplierSourceInput) => {
      try {
        await bridgeInvoke({ table: BRIDGE_TABLE, operation: 'insert', data: input });
        toast.success('Fonte de fornecimento adicionada');
        await fetchSources();
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (!msg.includes('duplicate') && !msg.includes('23505'))
          toast.error('Erro ao adicionar fonte');
        return false;
      }
    },
    [fetchSources],
  );

  const updateSource = useCallback(
    async (id: string, updates: Partial<SupplierSourceInput>) => {
      try {
        await bridgeInvoke({ table: BRIDGE_TABLE, operation: 'update', id, data: updates });
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
        await bridgeInvoke({ table: BRIDGE_TABLE, operation: 'delete', id });
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
        for (const src of sources) {
          if (src.is_preferred && src.id !== id)
            await bridgeInvoke({
              table: BRIDGE_TABLE,
              operation: 'update',
              id: src.id,
              data: { is_preferred: false },
            });
        }
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

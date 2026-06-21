/**
 * Hook for reading a product's supplier sources.
 *
 * REDESIGN (audit 2026-06-20): `variant_supplier_sources` is a PER-VARIANT table managed by
 * the supplier sync (XBZ/Bitrix). The previous implementation was doubly broken:
 *   - READ filtered it by a non-existent `product_id` column → the list was ALWAYS empty;
 *   - WRITE sent a shape (product_id/supplier_name/sale_price/notes…) whose columns don't
 *     exist and omitted the required `variant_id`/`organization_id` → every insert failed.
 *
 * Reads now follow the canonical variant-join pattern (see useVariantSupplierSources) and
 * aggregate the per-variant rows into a product-level summary per supplier. Manual per-product
 * writes are intentionally disabled (fail-loud): hand-writing rows into a sync-managed,
 * per-variant table from a product-level form would conflict with / be clobbered by the sync.
 * Full per-variant CRUD (selecting a variant, writing variant_id + organization_id) is a
 * separate, intentional change.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { dbInvoke } from '@/lib/db/postgrest';
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

export type SupplierSourceInput = Omit<SupplierSource, 'created_at' | 'id' | 'updated_at'>;

interface RawSource {
  supplier_id: string | null;
  supplier_sku: string | null;
  cost_price: number | null;
  your_price: number | null;
  list_price: number | null;
  lead_time_days: number | null;
  min_order_qty: number | null;
  is_preferred: boolean | null;
  is_active: boolean | null;
  stock_main_warehouse: number | null;
  stock_other_warehouses: number | null;
}

interface VariantRow {
  variant_supplier_sources?: RawSource[] | null;
}

const MANUAL_WRITE_MESSAGE =
  'Fontes de fornecimento são geridas por variante e sincronizadas com o fornecedor (XBZ/Bitrix). ' +
  'A edição manual por produto está indisponível.';

export function useProductSupplierSources(productId?: string) {
  const [sources, setSources] = useState<SupplierSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Supersede guard: a stale response for a previous productId must not overwrite the current.
  const fetchTokenRef = useRef(0);

  const fetchSources = useCallback(async () => {
    if (!productId) {
      setSources([]);
      return;
    }
    const token = ++fetchTokenRef.current;
    setIsLoading(true);
    try {
      // Per-variant sources joined through the product's variants (canonical pattern).
      const { records } = await dbInvoke<VariantRow>({
        table: 'product_variants',
        operation: 'select',
        select:
          'id, variant_supplier_sources(supplier_id, supplier_sku, cost_price, your_price, list_price, lead_time_days, min_order_qty, is_preferred, is_active, stock_main_warehouse, stock_other_warehouses)',
        filters: { product_id: productId, is_active: true },
        limit: 200,
      });

      // Aggregate the per-variant rows into one summary row per supplier.
      const bySupplier = new Map<string, SupplierSource>();
      for (const variant of records) {
        for (const raw of variant.variant_supplier_sources ?? []) {
          if (!raw.supplier_id) continue;
          const stock = (raw.stock_main_warehouse ?? 0) + (raw.stock_other_warehouses ?? 0);
          const rawCost = raw.cost_price ?? Number.POSITIVE_INFINITY;
          const existing = bySupplier.get(raw.supplier_id);
          if (existing) {
            existing.cost_price = Math.min(existing.cost_price, rawCost);
            existing.stock_quantity += stock;
            existing.is_preferred ||= !!raw.is_preferred;
            existing.is_active ||= !!raw.is_active;
            if (existing.lead_time_days === null && raw.lead_time_days !== null) {
              existing.lead_time_days = raw.lead_time_days;
            }
          } else {
            bySupplier.set(raw.supplier_id, {
              id: raw.supplier_id,
              product_id: productId,
              supplier_id: raw.supplier_id,
              supplier_name: raw.supplier_id, // resolved below
              supplier_sku: raw.supplier_sku ?? null,
              cost_price: rawCost,
              sale_price: raw.your_price ?? raw.list_price ?? 0,
              lead_time_days: raw.lead_time_days ?? null,
              stock_quantity: stock,
              min_order_quantity: raw.min_order_qty ?? 1,
              is_preferred: !!raw.is_preferred,
              is_active: !!raw.is_active,
              notes: null,
              created_at: '',
              updated_at: '',
            });
          }
        }
      }

      const list = Array.from(bySupplier.values());
      for (const s of list) if (!Number.isFinite(s.cost_price)) s.cost_price = 0;

      // Resolve supplier names (suppliers → v_suppliers_public via the Gold alias in dbInvoke).
      const ids = list.map((s) => s.supplier_id);
      if (ids.length > 0) {
        try {
          const { records: suppliers } = await dbInvoke<{ id: string; name: string }>({
            table: 'suppliers',
            operation: 'select',
            select: 'id,name',
            filters: { id: ids },
            limit: ids.length,
          });
          const nameById = new Map(suppliers.map((s) => [s.id, s.name]));
          for (const s of list) s.supplier_name = nameById.get(s.supplier_id) ?? s.supplier_id;
        } catch (nameErr) {
          logger.warn('Could not resolve supplier names for sources:', nameErr);
        }
      }

      list.sort((a, b) => {
        if (a.is_preferred !== b.is_preferred) return a.is_preferred ? -1 : 1;
        return (a.cost_price ?? 0) - (b.cost_price ?? 0);
      });

      if (token === fetchTokenRef.current) setSources(list);
    } catch (err: unknown) {
      logger.error('Error fetching supplier sources:', err);
      if (token === fetchTokenRef.current) setSources([]);
    } finally {
      if (token === fetchTokenRef.current) setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Manual per-product writes are intentionally disabled — see the file header. The table is
  // per-variant and sync-managed; surfacing a clear message beats silently failing or, worse,
  // writing malformed rows.
  // eslint-disable-next-line @typescript-eslint/require-await
  const addSource = useCallback(async (_input: SupplierSourceInput) => {
    toast.error(MANUAL_WRITE_MESSAGE);
    return false;
  }, []);

  // eslint-disable-next-line @typescript-eslint/require-await
  const updateSource = useCallback(async (_id: string, _updates: Partial<SupplierSourceInput>) => {
    toast.error(MANUAL_WRITE_MESSAGE);
    return false;
  }, []);

  // eslint-disable-next-line @typescript-eslint/require-await
  const removeSource = useCallback(async (_id: string) => {
    toast.error(MANUAL_WRITE_MESSAGE);
    return false;
  }, []);

  // eslint-disable-next-line @typescript-eslint/require-await
  const setPreferred = useCallback(async (_id: string) => {
    toast.error(MANUAL_WRITE_MESSAGE);
    return false;
  }, []);

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

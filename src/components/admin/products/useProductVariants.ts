/**
 * useProductVariants — CRUD logic for product variants.
 * Extracted from ProductVariantsSection.tsx.
 */
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BulkAction } from '@/components/products/VariantGridMatrix';

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  color_name: string | null;
  color_hex: string | null;
  color_code: string | null;
  stock_quantity: number | null;
  selected_thumbnail: string | null;
  is_active: boolean;
  product_id: string;
  supplier_sku: string | null;
  ean: string | null;
  size_code: string | null;
  capacity_ml: number | null;
  height_mm: number | null;
  width_mm: number | null;
  length_mm: number | null;
  weight_g: number | null;
}

export interface VariantFormData {
  name: string;
  sku: string;
  color_name: string;
  color_hex: string;
  stock_quantity: number;
  supplier_sku: string;
  ean: string;
  size_code: string;
  capacity_ml: number | null;
  height_mm: number | null;
  width_mm: number | null;
  length_mm: number | null;
  weight_g: number | null;
}

export const EMPTY_FORM: VariantFormData = {
  name: '',
  sku: '',
  color_name: '',
  color_hex: '#000000',
  stock_quantity: 0,
  supplier_sku: '',
  ean: '',
  size_code: '',
  capacity_ml: null,
  height_mm: null,
  width_mm: null,
  length_mm: null,
  weight_g: null,
};

// ── API helpers ──

async function fetchProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase.functions.invoke('external-db-bridge', {
    body: {
      table: 'product_variants',
      operation: 'select',
      filters: { product_id: productId, is_active: true },
      limit: 200,
      orderBy: { column: 'name', ascending: true },
    },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Erro ao buscar variações');
  return data.data?.records || [];
}

async function createVariantApi(payload: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke('external-db-bridge', {
    body: { table: 'product_variants', operation: 'insert', data: payload },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Erro ao criar variação');
}

async function updateVariantApi(id: string, payload: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke('external-db-bridge', {
    body: { table: 'product_variants', operation: 'update', id, data: payload },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Erro ao atualizar variação');
}

async function deleteVariantApi(id: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('external-db-bridge', {
    body: { table: 'product_variants', operation: 'update', id, data: { is_active: false } },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Erro ao excluir variação');
}

function formToPayload(formData: VariantFormData, extra?: Record<string, unknown>) {
  return {
    ...extra,
    name: formData.name.trim(),
    sku: formData.sku.trim(),
    color_name: formData.color_name.trim() || null,
    color_hex: formData.color_hex || null,
    stock_quantity: formData.stock_quantity,
    supplier_sku: formData.supplier_sku.trim() || null,
    ean: formData.ean.trim() || null,
    size_code: formData.size_code.trim() || null,
    capacity_ml: formData.capacity_ml,
    height_mm: formData.height_mm,
    width_mm: formData.width_mm,
    length_mm: formData.length_mm,
    weight_g: formData.weight_g,
  };
}

export function useProductVariants(productId: string, productName?: string, productSku?: string) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductVariant | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const {
    data: variants = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: () => fetchProductVariants(productId),
    enabled: !!productId,
    staleTime: 2 * 60 * 1000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
  }, [queryClient, productId]);

  const handleCreate = async (formData: VariantFormData) => {
    setIsSaving(true);
    try {
      await createVariantApi(formToPayload(formData, { product_id: productId, is_active: true }));
      toast.success('Variação criada com sucesso');
      setIsCreating(false);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar variação');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (variantId: string, formData: VariantFormData) => {
    setIsSaving(true);
    try {
      await updateVariantApi(variantId, formToPayload(formData));
      toast.success('Variação atualizada');
      setEditingId(null);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await deleteVariantApi(deleteTarget.id);
      toast.success('Variação removida');
      setDeleteTarget(null);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkAction = useCallback(
    async (action: BulkAction) => {
      setIsBulkLoading(true);
      try {
        const promises = action.variantIds.map((id) => {
          if (action.type === 'toggle_active')
            return updateVariantApi(id, { is_active: action.value as boolean });
          if (action.type === 'update_stock')
            return updateVariantApi(id, { stock_quantity: action.value as number });
          return Promise.resolve();
        });
        await Promise.all(promises);
        const label =
          action.type === 'toggle_active'
            ? action.value
              ? 'ativadas'
              : 'desativadas'
            : 'atualizadas';
        toast.success(`${action.variantIds.length} variações ${label}`);
        invalidate();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro na operação em lote');
      } finally {
        setIsBulkLoading(false);
      }
    },
    [invalidate],
  );

  const totalStock = variants.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0);

  const createInitial: VariantFormData = {
    ...EMPTY_FORM,
    name: productName ? `${productName} - ` : '',
    sku: productSku ? `${productSku}-` : '',
  };

  return {
    variants,
    isLoading,
    error,
    totalStock,
    editingId,
    setEditingId,
    isCreating,
    setIsCreating,
    isSaving,
    deleteTarget,
    setDeleteTarget,
    isBulkLoading,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleBulkAction,
    createInitial,
  };
}

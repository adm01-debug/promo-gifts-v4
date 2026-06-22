import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ColorSwatch {
  variant_id: string;
  sku: string;
  color_id: string;
  color_name: string;
  color_hex: string;
  stock_quantity: number;
  image_url: string | null;
  is_in_stock: boolean;
}

export interface ProductWithSwatches {
  id: string;
  name: string;
  primary_image_url?: string | null;
  stock_quantity?: number;
  color_swatches?: ColorSwatch[];
  has_colors?: boolean;
  [key: string]: unknown;
}

export function useProductColorSwatch(product: ProductWithSwatches) {
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [lazySwatches, setLazySwatches] = useState<ColorSwatch[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const swatches: ColorSwatch[] = useMemo(() => {
    if (lazySwatches) return lazySwatches;
    return (product.color_swatches as ColorSwatch[]) ?? [];
  }, [product.color_swatches, lazySwatches]);

  const activeVariant = useMemo(
    () => swatches.find((s) => s.variant_id === activeVariantId) ?? null,
    [swatches, activeVariantId]
  );

  const displayImage = activeVariant?.image_url ?? product.primary_image_url ?? null;
  const displayStock = activeVariant?.stock_quantity ?? product.stock_quantity ?? 0;
  const isFiltered = activeVariantId !== null;
  const stockLabel = isFiltered ? 'Estoque nesta cor' : 'Estoque total';

  const selectVariant = useCallback((variantId: string) => {
    setActiveVariantId(variantId);
  }, []);

  const resetActive = useCallback(() => {
    setActiveVariantId(null);
  }, []);

  const fetchSwatchesIfNeeded = useCallback(async () => {
    if (!product.has_colors) return;
    if (swatches.length > 0) return;
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('fn_get_color_swatches_batch', { p_product_ids: [product.id] });
      if (!error && data && data.length > 0) {
        setLazySwatches(data[0].color_swatches as ColorSwatch[]);
      }
    } catch (_) {
      // Silent fail — product displays without swatches
    } finally {
      setIsLoading(false);
    }
  }, [product.id, product.has_colors, swatches.length, isLoading]);

  return {
    swatches,
    activeVariant,
    activeVariantId,
    displayImage,
    displayStock,
    stockLabel,
    isFiltered,
    isLoading,
    selectVariant,
    resetActive,
    fetchSwatchesIfNeeded,
  };
}

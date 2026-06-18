/**
 * useColorEnrichment — Batch-enriches lightweight products with color-specific
 * images and stock when a color filter is active.
 *
 * Without this, lightweight products have colors: [] and the card cannot
 * show the variant image/stock for the filtered color.
 *
 * Uses incremental enrichment: keeps a growing cache of results and only
 * fetches data for NEW product IDs that haven't been enriched yet.
 */
import { getCatalogStockStatus } from '@/lib/catalog-stock-status';
import { useQuery } from '@tanstack/react-query';
import { useRef, useMemo, useEffect } from 'react';
import { dbInvoke } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';

interface ColorEnrichmentData {
  image: string | null;
  stock: number;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  colorName: string | null;
  colorHex: string | null;
}

interface UseColorEnrichmentOptions {
  /** Product IDs to enrich (should be the visible/filtered set) */
  productIds: string[];
  /** Active color group slugs */
  colorGroups: string[];
  /** Active color variation slugs */
  colorVariations: string[];
}

// Cached reference tables (shared across instances)
let cachedColorGroups: Array<{ id: string; slug: string }> | null = null;
let cachedColorVariations: Array<{
  id: string;
  name: string;
  slug: string;
  group_id: string;
  hex_code?: string | null;
}> | null = null;

/**
 * Returns a Map<productId, ColorEnrichmentData> for products matching the color filter.
 */
export function useColorEnrichment({
  productIds,
  colorGroups,
  colorVariations,
}: UseColorEnrichmentOptions) {
  const hasFilter = colorGroups.length > 0 || colorVariations.length > 0;
  const filterKey = `${[...colorGroups].sort().join(',')}|${[...colorVariations].sort().join(',')}`;

  // Accumulator: track which product IDs have already been enriched for this filter
  const enrichedIdsRef = useRef<Set<string>>(new Set());
  const accumulatedMapRef = useRef<Map<string, ColorEnrichmentData>>(new Map());
  const lastFilterKeyRef = useRef<string>(filterKey);

  // Reset cache when filter changes — use useEffect to avoid mutating refs during render
  useEffect(() => {
    if (lastFilterKeyRef.current !== filterKey) {
      enrichedIdsRef.current = new Set();
      accumulatedMapRef.current = new Map();
      lastFilterKeyRef.current = filterKey;
    }
  }, [filterKey]);

  // Find product IDs that haven't been enriched yet
  const newProductIds = useMemo(() => {
    if (!hasFilter) return [];
    const enrichedIds =
      lastFilterKeyRef.current === filterKey ? enrichedIdsRef.current : new Set<string>();
    return productIds.filter((id) => !enrichedIds.has(id));
  }, [productIds, hasFilter, filterKey]);

  // Chave por CONTEÚDO dos IDs (não só `.length`): dois conjuntos de IDs
  // distintos com o mesmo tamanho colidiam na mesma entrada de cache e serviam
  // enrichment do conjunto errado. `newProductIds` é memoizado em deps estáveis,
  // então a chave não muda após o enrich (sem loop de refetch).
  const queryEnabled = hasFilter && newProductIds.length > 0;

  const query = useQuery({
    queryKey: ['color-enrichment-batch', filterKey, newProductIds.join(',')],
    queryFn: async (): Promise<Map<string, ColorEnrichmentData>> => {
      if (lastFilterKeyRef.current !== filterKey) {
        enrichedIdsRef.current = new Set();
        accumulatedMapRef.current = new Map();
        lastFilterKeyRef.current = filterKey;
      }

      if (newProductIds.length === 0) return accumulatedMapRef.current;

      // Step 1: Load reference tables (cached after first call)
      if (!cachedColorGroups || !cachedColorVariations) {
        const refResults = await Promise.all([
          dbInvoke<{ id: string; slug: string }>({
            table: 'color_groups',
            operation: 'select',
            select: 'id, slug',
            filters: { is_active: true },
            limit: 200,
            offset: 0,
          }),
          dbInvoke<{
            id: string;
            name: string;
            slug: string;
            group_id: string;
            hex_code: string | null;
          }>({
            table: 'color_variations',
            operation: 'select',
            select: 'id, name, slug, group_id, hex_code',
            filters: { is_active: true },
            limit: 500,
            offset: 0,
          }),
        ]);

        cachedColorGroups = refResults[0].records ?? [];
        cachedColorVariations = refResults[1].records ?? [];
      }

      const colorGroupsCache = cachedColorGroups ?? [];
      const colorVariationsCache = cachedColorVariations ?? [];
      const groupsBySlug = new Map(colorGroupsCache.map((g) => [g.slug, g.id]));
      const variationsBySlug = new Map(colorVariationsCache.map((v) => [v.slug, v]));

      // Resolve target color_ids
      const targetColorIds = new Set<string>();

      for (const slug of colorVariations) {
        const v = variationsBySlug.get(slug);
        if (v) targetColorIds.add(v.id);
      }

      for (const slug of colorGroups) {
        const groupId = groupsBySlug.get(slug);
        if (groupId) {
          for (const v of colorVariationsCache) {
            if (v.group_id === groupId) targetColorIds.add(v.id);
          }
        }
      }

      if (targetColorIds.size === 0) return accumulatedMapRef.current;

      // Step 2: Fetch variants for NEW products with these color_ids
      const colorIdArray = [...targetColorIds];
      const CHUNK = 80; // Smaller chunks to stay well within limits
      const allVariants: Array<{
        product_id: string;
        color_id: string | null;
        color_name: string | null;
        color_hex: string | null;
        color_code: string | null;
        stock_quantity: number | null;
        selected_thumbnail: string | null;
        images: string[] | null;
        id: string;
      }> = [];

      for (let i = 0; i < newProductIds.length; i += CHUNK) {
        const pidChunk = newProductIds.slice(i, i + CHUNK);
        const result = await dbInvoke<(typeof allVariants)[number]>({
          table: 'product_variants',
          operation: 'select',
          select:
            'id, product_id, color_id, color_name, color_hex, color_code, stock_quantity, selected_thumbnail, images',
          filters: { is_active: true, product_id: pidChunk, color_id: colorIdArray },
          limit: 3000,
          offset: 0,
        });

        if (result.records?.length) {
          allVariants.push(...result.records);
        }
      }

      // Step 3: Fetch images for products with variants
      const productIdsWithVariants = [...new Set(allVariants.map((v) => v.product_id))];
      const allImages: Array<{
        product_id: string;
        variant_id: string | null;
        supplier_code: string | null;
        url_cdn: string | null;
        is_og_image: boolean | null;
        is_primary: boolean | null;
        image_type: string | null;
      }> = [];

      for (let i = 0; i < productIdsWithVariants.length; i += CHUNK) {
        const pidChunk = productIdsWithVariants.slice(i, i + CHUNK);
        const result = await dbInvoke<(typeof allImages)[number]>({
          table: 'product_images',
          operation: 'select',
          select:
            'product_id, variant_id, supplier_code, url_cdn, is_og_image, is_primary, image_type',
          filters: { product_id: pidChunk },
          limit: 3000,
          offset: 0,
        });

        if (result.records?.length) {
          allImages.push(...result.records);
        }
      }

      // Build image lookup maps — scoped per product to avoid cross-contamination
      const imagesByVariantId = new Map<string, string>();
      // Key: "productId|SUPPLIER_CODE" to avoid one product's image leaking to another
      const imagesByProductAndCode = new Map<string, string>();
      const primaryImagesByProduct = new Map<string, Set<string>>();

      for (const img of allImages) {
        if (!img.url_cdn || img.image_type === 'box') continue;
        if ((img.is_primary || img.is_og_image) && img.url_cdn) {
          if (!primaryImagesByProduct.has(img.product_id))
            primaryImagesByProduct.set(img.product_id, new Set());
          primaryImagesByProduct.get(img.product_id)?.add(img.url_cdn);
        }
        if (img.variant_id) {
          if (!imagesByVariantId.has(img.variant_id) || img.is_og_image) {
            imagesByVariantId.set(img.variant_id, img.url_cdn);
          }
        }
        if (img.supplier_code) {
          const key = `${img.product_id}|${img.supplier_code.toUpperCase()}`;
          if (!imagesByProductAndCode.has(key) || img.is_og_image) {
            imagesByProductAndCode.set(key, img.url_cdn);
          }
        }
      }

      // Step 4: Build enrichment for new products
      const variantsByProduct = new Map<string, typeof allVariants>();
      for (const v of allVariants) {
        if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
        variantsByProduct.get(v.product_id)?.push(v);
      }

      let withImage = 0;
      let withoutImage = 0;

      for (const [productId, variants] of variantsByProduct) {
        let totalStock = 0;
        let bestImage: string | null = null;
        let bestColorName: string | null = null;
        let bestColorHex: string | null = null;

        // First pass: accumulate stock and find best image across ALL matching variants
        for (const v of variants) {
          totalStock += v.stock_quantity ?? 0;
        }

        // Second pass: try each variant for an image (prioritize variants WITH images)
        for (const v of variants) {
          if (bestImage) break;
          // Priority 1: Direct variant_id link in product_images
          const variantImage = imagesByVariantId.get(v.id) || null;
          if (variantImage) {
            bestImage = variantImage;
            bestColorName = v.color_name;
            bestColorHex = v.color_hex;
            break;
          }
          // Priority 2: color_code → supplier_code match
          const colorImage = v.color_code
            ? imagesByProductAndCode.get(`${productId}|${v.color_code.toUpperCase()}`) || null
            : null;
          if (colorImage) {
            bestImage = colorImage;
            bestColorName = v.color_name;
            bestColorHex = v.color_hex;
            break;
          }
        }

        // Priority 3: selected_thumbnail (only if not the main product image)
        if (!bestImage) {
          for (const v of variants) {
            if (v.selected_thumbnail) {
              const productPrimaries = primaryImagesByProduct.get(productId);
              const isMainImage = productPrimaries?.has(v.selected_thumbnail) ?? false;
              if (!isMainImage) {
                bestImage = v.selected_thumbnail;
                bestColorName = v.color_name;
                bestColorHex = v.color_hex;
                break;
              }
            }
          }
        }

        // Priority 4: variant images[] array
        if (!bestImage) {
          for (const v of variants) {
            if (v.images?.length) {
              // Filter out main product images from variant images
              const productPrimaries = primaryImagesByProduct.get(productId);
              const validImages = v.images.filter((img) => !productPrimaries?.has(img));
              if (validImages.length > 0) {
                bestImage = validImages[0];
                bestColorName = v.color_name;
                bestColorHex = v.color_hex;
                break;
              }
              // Last resort: use first image even if it's a main image
              if (v.images.length > 0) {
                bestImage = v.images[0];
                bestColorName = v.color_name;
                bestColorHex = v.color_hex;
                break;
              }
            }
          }
        }

        // Set color name/hex even without image
        if (!bestColorName && variants.length > 0) {
          bestColorName = variants[0].color_name;
          bestColorHex = variants[0].color_hex;
        }

        if (bestImage) withImage++;
        else withoutImage++;

        accumulatedMapRef.current.set(productId, {
          image: bestImage,
          stock: totalStock,
          stockStatus: getCatalogStockStatus(totalStock),
          colorName: bestColorName,
          colorHex: bestColorHex,
        });
      }

      // Mark all new product IDs as enriched (even those without variants)
      for (const id of newProductIds) {
        enrichedIdsRef.current.add(id);
      }

      logger.log(
        `[useColorEnrichment] Enriched ${newProductIds.length} new products (${accumulatedMapRef.current.size} total) for ${colorIdArray.length} color IDs | withImage: ${withImage}, withoutImage: ${withoutImage}, noVariant: ${newProductIds.length - variantsByProduct.size}`,
      );
      return new Map(accumulatedMapRef.current);
    },
    enabled: queryEnabled,
    staleTime: 30 * 1000, // Short stale time to allow incremental fetches
    gcTime: 10 * 60 * 1000,
  });

  // Return accumulated map even when query isn't running (for already-enriched products)
  const resultMap =
    query.data || (accumulatedMapRef.current.size > 0 ? accumulatedMapRef.current : undefined);

  return { data: resultMap, isLoading: query.isLoading };
}

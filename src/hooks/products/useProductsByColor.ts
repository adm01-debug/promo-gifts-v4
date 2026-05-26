/**
 * useProductsByColor — Server-side color filtering
 *
 * Queries product_variants + color_variations + color_groups via external-db-bridge
 * to return product IDs matching selected color filters.
 * Works with lightweight products that don't have embedded color data.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invokeBatchBridge } from '@/lib/external-db';
import { logger } from '@/lib/logger';

interface UseProductsByColorOptions {
  colorGroups: string[]; // group slugs
  colorVariations: string[]; // variation slugs
  colorNuances: string[]; // nuance keywords (client-side only, not supported server-side)
  colors: string[]; // legacy color names
}

interface UseProductsByColorResult {
  productIds: Set<string>;
  hasFilter: boolean;
  isLoading: boolean;
}

export function useProductsByColor({
  colorGroups,
  colorVariations,
  colorNuances,
  colors,
}: UseProductsByColorOptions): UseProductsByColorResult {
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const hasFilter = useMemo(
    () =>
      colorGroups.length > 0 ||
      colorVariations.length > 0 ||
      colorNuances.length > 0 ||
      colors.length > 0,
    [colorGroups.length, colorVariations.length, colorNuances.length, colors.length],
  );

  const filterKey = useMemo(
    () =>
      [...colorGroups].sort().join(',') +
      '|' +
      [...colorVariations].sort().join(',') +
      '|' +
      [...colorNuances].sort().join(',') +
      '|' +
      [...colors].sort().join(','),
    [colorGroups, colorVariations, colorNuances, colors],
  );

  const lastFetchedKey = useRef('');
  const isFetchingRef = useRef(false);

  const fetchProductIds = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (lastFetchedKey.current === filterKey) return;

    if (!hasFilter) {
      setProductIds(new Set());
      lastFetchedKey.current = '';
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      // Step 1: Load color_groups and color_variations reference tables
      const refQueries = [
        {
          table: 'color_groups',
          operation: 'select' as const,
          select: 'id, name, slug',
          filters: { is_active: true },
          limit: 200,
          offset: 0,
          cacheKey: 'ref:color_groups',
        },
        {
          table: 'color_variations',
          operation: 'select' as const,
          select: 'id, name, slug, group_id',
          filters: { is_active: true },
          limit: 500,
          offset: 0,
          cacheKey: 'ref:color_variations',
        },
      ];

      const refResults = await invokeBatchBridge(refQueries);

      const groupsData = refResults[0]?.success
        ? (refResults[0].data?.records as Record<string, unknown>[]) || []
        : [];
      const variationsData = refResults[1]?.success
        ? (refResults[1].data?.records as Record<string, unknown>[]) || []
        : [];

      // Build lookup maps
      const groupsBySlug = new Map(
        groupsData.map((g: Record<string, unknown>) => [g.slug as string, g.id as string]),
      );
      const variationsBySlug = new Map(
        variationsData.map((v: Record<string, unknown>) => [v.slug as string, v]),
      );

      // Resolve target color_ids from filters
      const targetColorIds = new Set<string>();

      // From colorVariations (slug -> variation id)
      for (const slug of colorVariations) {
        const variation = variationsBySlug.get(slug);
        if (variation) targetColorIds.add(variation.id as string);
      }

      // From colorGroups (slug -> group id -> all variations in that group)
      for (const slug of colorGroups) {
        const groupId = groupsBySlug.get(slug);
        if (groupId) {
          for (const v of variationsData) {
            if ((v as Record<string, unknown>).group_id === groupId) {
              targetColorIds.add((v as Record<string, unknown>).id as string);
            }
          }
        }
      }

      // From legacy color names: match variation names
      for (const colorName of colors) {
        const lower = colorName.toLowerCase();
        for (const v of variationsData) {
          if (((v as Record<string, unknown>).name as string)?.toLowerCase() === lower) {
            targetColorIds.add((v as Record<string, unknown>).id as string);
          }
        }
      }

      if (targetColorIds.size === 0 && colorNuances.length === 0) {
        // No matching color_ids found — no products match
        setProductIds(new Set());
        lastFetchedKey.current = filterKey;
        return;
      }

      // Step 2: Query product_variants to get product_ids matching those color_ids
      const colorIdArray = [...targetColorIds];
      const matchingProductIds = new Set<string>();

      if (colorIdArray.length > 0) {
        // Fetch in chunks of 50 color_ids
        const CHUNK = 50;
        for (let i = 0; i < colorIdArray.length; i += CHUNK) {
          const chunk = colorIdArray.slice(i, i + CHUNK);
          const variantQueries = [
            {
              table: 'product_variants',
              operation: 'select' as const,
              select: 'product_id',
              filters: { is_active: true, color_id: chunk },
              limit: 5000,
              offset: 0,
            },
          ];

          const variantResults = await invokeBatchBridge(variantQueries);
          if (variantResults[0]?.success && variantResults[0].data?.records) {
            for (const r of variantResults[0].data.records as Array<{ product_id: string }>) {
              matchingProductIds.add(r.product_id);
            }
          }
        }
      }

      setProductIds(matchingProductIds);
      lastFetchedKey.current = filterKey;
      logger.log(
        `[useProductsByColor] Found ${matchingProductIds.size} products for ${colorIdArray.length} color IDs`,
      );
    } catch (err) {
      logger.error('[useProductsByColor] Critical Error:', err);
      // Fallback: em caso de erro crítico na bridge de cores, permitimos
      // visualização parcial ou vazia mas logamos o erro estruturado.
      setProductIds(new Set());
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [filterKey, hasFilter]);

  useEffect(() => {
    if (filterKey !== lastFetchedKey.current || !hasFilter) {
      fetchProductIds();
    }
  }, [filterKey, hasFilter, fetchProductIds]);

  return { productIds, hasFilter, isLoading };
}

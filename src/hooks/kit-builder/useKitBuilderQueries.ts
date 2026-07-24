/**
 * Kit Builder Queries Hook
 * Isolates React Query calls to prevent "Should have a queue" React bug
 * caused by too many hooks in a single component/hook.
 */

import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  type KitBox,
  type KitItem,
  type BoxFilters,
  type ItemFilters,
  type ExternalProductForKit,
} from '@/lib/kit-builder';
import { MOCK_BOXES, MOCK_ITEMS } from '@/lib/kit-builder/mock-data';

// Import transformers from the main hook file
import {
  transformToKitBox,
  transformToKitItem,
} from '@/hooks/kit-builder/useKitBuilderTransformers';
import { logger } from '@/lib/logger';

function filterBoxes(
  boxes: KitBox[],
  search: string | null,
  dimFilters?: Omit<BoxFilters, 'search'>,
): KitBox[] {
  let filtered = boxes;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (b) => b.name.toLowerCase().includes(q) || b.sku.toLowerCase().includes(q),
    );
  }
  if (dimFilters?.minWidth) {
    const minWidth = dimFilters.minWidth;
    filtered = filtered.filter((b) => b.internalWidth >= minWidth);
  }
  if (dimFilters?.minHeight) {
    const minHeight = dimFilters.minHeight;
    filtered = filtered.filter((b) => b.internalHeight >= minHeight);
  }
  if (dimFilters?.minDepth) {
    const minDepth = dimFilters.minDepth;
    filtered = filtered.filter((b) => b.internalDepth >= minDepth);
  }
  if (dimFilters?.material) filtered = filtered.filter((b) => b.material === dimFilters.material);
  return filtered;
}

function filterItems(items: KitItem[], search: string): KitItem[] {
  if (!search) return items;
  const q = search.toLowerCase();
  return items.filter((i) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
}

export function useKitBuilderQueries() {
  // Debounced search state
  const [boxSearchInput, setBoxSearchInput] = useState('');
  const [itemSearchInput, setItemSearchInput] = useState('');
  const [debouncedBoxSearch, setDebouncedBoxSearch] = useState('');
  const [debouncedItemSearch, setDebouncedItemSearch] = useState('');
  const [boxDimFilters, setBoxDimFilters] = useState<Omit<BoxFilters, 'search'>>({});
  const [itemExtraFilters, setItemExtraFilters] = useState<Omit<ItemFilters, 'search'>>({});

  // Debounce with cleanup
  const boxTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const itemTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (boxTimerRef.current) clearTimeout(boxTimerRef.current);
    boxTimerRef.current = setTimeout(() => setDebouncedBoxSearch(boxSearchInput), 300);
    return () => {
      if (boxTimerRef.current) clearTimeout(boxTimerRef.current);
    };
  }, [boxSearchInput]);

  useEffect(() => {
    if (itemTimerRef.current) clearTimeout(itemTimerRef.current);
    itemTimerRef.current = setTimeout(() => setDebouncedItemSearch(itemSearchInput), 300);
    return () => {
      if (itemTimerRef.current) clearTimeout(itemTimerRef.current);
    };
  }, [itemSearchInput]);

  const setBoxFilters = useCallback((filters: BoxFilters) => {
    setBoxSearchInput(filters.search || '');
    const { search: _boxSearch, ...rest } = filters;
    setBoxDimFilters(rest);
  }, []);

  const setItemFilters = useCallback((filters: ItemFilters) => {
    setItemSearchInput(filters.search || '');
    const { search: _itemSearch, ...rest } = filters;
    setItemExtraFilters(rest);
  }, []);

  // Query: boxes — products that have packing_type containing "Caixa" or similar packaging terms
  const { data: availableBoxes = [], isLoading: isLoadingBoxes } = useQuery({
    queryKey: [
      'kit-builder',
      'boxes',
      debouncedBoxSearch,
      boxDimFilters.minWidth ?? '',
      boxDimFilters.minHeight ?? '',
      boxDimFilters.minDepth ?? '',
      boxDimFilters.material ?? '',
    ],
    queryFn: async () => {
      try {
        const filters: Record<string, unknown> = { active: true };
        if (debouncedBoxSearch) filters._search = debouncedBoxSearch;

        const result = await dbInvoke<ExternalProductForKit>({
          table: 'products',
          operation: 'select',
          filters,
          select:
            'id, name, sku, sale_price, primary_image_url, images, dimensions, category_id, weight_g, materials, width_cm, height_cm, length_cm, internal_width_cm, internal_height_cm, internal_length_cm, packing_type, packing_classification',
          limit: 200,
          orderBy: { column: 'name', ascending: true },
          countMode: 'none',
        });

        const boxes = result.records
          .filter((p) => {
            const pt = (p.packing_type || '').toLowerCase();
            return pt.includes('caixa') || pt.includes('embalagem') || pt.includes('box');
          })
          .map((p) => transformToKitBox(p))
          .filter((box): box is KitBox => box !== null);

        if (boxes.length === 0) {
          logger.info('[KitBuilder] No boxes from external DB, using mock data');
          return filterBoxes(MOCK_BOXES, debouncedBoxSearch, boxDimFilters);
        }

        return filterBoxes(boxes, null, boxDimFilters);
      } catch (err) {
        logger.warn('[KitBuilder] External DB unavailable for boxes, using mock data', err);
        return filterBoxes(MOCK_BOXES, debouncedBoxSearch, boxDimFilters);
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Query: items
  const { data: availableItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['kit-builder', 'items', debouncedItemSearch],
    queryFn: async () => {
      try {
        const filters: Record<string, unknown> = { active: true };
        if (debouncedItemSearch) filters._search = debouncedItemSearch;

        const result = await dbInvoke<ExternalProductForKit>({
          table: 'products',
          operation: 'select',
          filters,
          select:
            'id, name, sku, sale_price, primary_image_url, images, dimensions, category_id, weight_g, materials, width_cm, height_cm, length_cm, colors, packing_classification',
          limit: 200,
          orderBy: { column: 'name', ascending: true },
          countMode: 'none',
        });

        const items = result.records
          .filter((p) => p.packing_classification !== 'embalagem')
          .map((p) => transformToKitItem(p));

        if (items.length === 0) {
          logger.info('[KitBuilder] No items from external DB, using mock data');
          return filterItems(MOCK_ITEMS, debouncedItemSearch);
        }

        return items;
      } catch (err) {
        logger.warn('[KitBuilder] External DB unavailable for items, using mock data', err);
        return filterItems(MOCK_ITEMS, debouncedItemSearch);
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    availableBoxes,
    availableItems,
    isLoadingBoxes,
    isLoadingItems,
    boxFilters: { search: boxSearchInput, ...boxDimFilters } as BoxFilters,
    itemFilters: { search: itemSearchInput, ...itemExtraFilters } as ItemFilters,
    setBoxFilters,
    setItemFilters,
  };
}

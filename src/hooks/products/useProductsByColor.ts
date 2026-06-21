/**
 * useProductsByColor — Server-side color filtering
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logger } from '@/lib/logger';

interface UseProductsByColorOptions {
  colorGroups: string[];
  colorVariations: string[];
  colorNuances: string[];
  colors: string[];
}

interface UseProductsByColorResult {
  productIds: Set<string>;
  hasFilter: boolean;
  isLoading: boolean;
  error: unknown;
}

export function useProductsByColor({
  colorGroups,
  colorVariations,
  colorNuances,
  colors,
}: UseProductsByColorOptions): UseProductsByColorResult {
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

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
      `${[...colorGroups].sort().join(',')}|${[...colorVariations].sort().join(',')}|${[...colorNuances].sort().join(',')}|${[...colors].sort().join(',')}`,
    [colorGroups, colorVariations, colorNuances, colors],
  );

  const lastFetchedKey = useRef('');
  // fetchTokenRef: each new call increments the token; only the latest call applies
  // setState — stale results from slow in-flight requests are discarded.
  const fetchTokenRef = useRef(0);
  // abortControllerRef: cancels the previous HTTP request so network bandwidth is not
  // wasted on superseded fetches (token alone prevents stale setState but not network I/O).
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProductIds = useCallback(async () => {
    if (lastFetchedKey.current === filterKey) return;
    if (!hasFilter) {
      // Abort any in-flight request and invalidate its token so the stale
      // setState in its finally/resolve path cannot overwrite the cleared state.
      abortControllerRef.current?.abort();
      ++fetchTokenRef.current;
      setIsLoading(false);
      // FIX BUG-RENDER-COLOR-01: conditional setState prevents render loop.
      // new Set() creates a different object reference every call; when productIds is
      // already empty, React's Object.is check on the prev ref short-circuits the
      // re-render that would re-trigger this effect indefinitely.
      setProductIds((prev) => (prev.size === 0 ? prev : new Set()));
      lastFetchedKey.current = '';
      return;
    }

    const token = ++fetchTokenRef.current;
    // Cancel the previous in-flight request before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;
    setIsLoading(true);
    setError(null);

    try {
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
          select: 'id, name, slug, group_id, nuance_id',
          filters: { is_active: true },
          limit: 500,
          offset: 0,
          cacheKey: 'ref:color_variations',
        },
        {
          table: 'color_nuances',
          operation: 'select' as const,
          select: 'id, name, slug',
          filters: { is_active: true },
          limit: 500,
          offset: 0,
          cacheKey: 'ref:color_nuances',
        },
      ];

      const refResults = await Promise.all(refQueries.map((q) => dbInvoke({ ...q, signal })));
      if (token !== fetchTokenRef.current) return; // superseded

      const groupsData = (refResults[0]?.records ?? []) as Record<string, unknown>[];
      const variationsData = (refResults[1]?.records ?? []) as Record<string, unknown>[];

      const groupsBySlug = new Map(groupsData.map((g) => [g.slug as string, g.id as string]));
      const variationsBySlug = new Map(variationsData.map((v) => [v.slug as string, v]));

      const targetColorIds = new Set<string>();
      for (const slug of colorVariations) {
        const v = variationsBySlug.get(slug);
        if (v) targetColorIds.add(v.id as string);
      }
      for (const slug of colorGroups) {
        const gid = groupsBySlug.get(slug);
        if (gid)
          for (const v of variationsData)
            if ((v as Record<string, unknown>).group_id === gid)
              targetColorIds.add((v as Record<string, unknown>).id as string);
      }
      for (const colorName of colors) {
        const lower = colorName.toLowerCase();
        for (const v of variationsData)
          if (((v as Record<string, unknown>).name as string)?.toLowerCase() === lower)
            targetColorIds.add((v as Record<string, unknown>).id as string);
      }

      // FIX-NUANCE (2026-06-18): resolve nuances (color_nuances.slug) via
      // color_variations.nuance_id -> variation ids -> product_variants.color_id.
      // Antes, colorNuances era IGNORADO: nuance sozinha zerava (targetColorIds vazio)
      // e nuance combinada era silenciosamente descartada. Semantica OR (uniao),
      // consistente com group/variation/color dentro do mesmo bloco de cor.
      if (colorNuances.length > 0) {
        const nuancesData = (refResults[2]?.records ?? []) as Record<string, unknown>[];
        const nuanceIdBySlug = new Map(nuancesData.map((n) => [n.slug as string, n.id as string]));
        const targetNuanceIds = new Set<string>();
        for (const slug of colorNuances) {
          const nid = nuanceIdBySlug.get(slug);
          if (nid) targetNuanceIds.add(nid);
        }
        for (const v of variationsData) {
          const nid = (v as Record<string, unknown>).nuance_id as string | null;
          if (nid && targetNuanceIds.has(nid))
            targetColorIds.add((v as Record<string, unknown>).id as string);
        }
      }

      if (targetColorIds.size === 0) {
        if (token !== fetchTokenRef.current) return; // superseded
        setProductIds(new Set());
        lastFetchedKey.current = filterKey;
        return;
      }

      const colorIdArray = [...targetColorIds];
      const matchingProductIds = new Set<string>();

      if (colorIdArray.length > 0) {
        // PERF-COLOR-01 (2026-06-18): chunks paralelos em vez de serial.
        // Antes: loop com await serial → cada CHUNK = 1 round-trip sequential.
        // Depois: Promise.all → todos os chunks em paralelo → até 3× mais rápido
        // para filtros de cor com >50 color IDs (ex: grupo inteiro de cores).
        // Edge: se 1 chunk falha, Promise.all rejeita → catch zera productIds (safe).
        const CHUNK = 50;
        const chunks: string[][] = [];
        for (let i = 0; i < colorIdArray.length; i += CHUNK) {
          chunks.push(colorIdArray.slice(i, i + CHUNK));
        }

        const chunkResults = await Promise.all(
          chunks.map((chunk) =>
            dbInvoke<{ product_id: string }>({
              table: 'product_variants',
              operation: 'select',
              select: 'product_id',
              filters: { is_active: true, color_id: chunk },
              limit: 5000,
              offset: 0,
              signal,
            }),
          ),
        );

        for (const result of chunkResults) {
          if (result?.records) {
            for (const r of result.records) {
              matchingProductIds.add(r.product_id);
            }
          }
        }
      }

      if (token !== fetchTokenRef.current) return; // superseded
      setProductIds(matchingProductIds);
      lastFetchedKey.current = filterKey;
      logger.log(
        `[useProductsByColor] Found ${matchingProductIds.size} products for ${colorIdArray.length} color IDs`,
      );
    } catch (err) {
      // Ignore aborted requests — a new fetch is already in-flight
      if ((err as { name?: string })?.name === 'AbortError') return;
      if (token !== fetchTokenRef.current) return; // superseded
      logger.error('[useProductsByColor] Critical Error:', err);
      setError(err);
      setProductIds(new Set());
    } finally {
      if (token === fetchTokenRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, hasFilter]);

  useEffect(() => {
    if (filterKey !== lastFetchedKey.current || !hasFilter) fetchProductIds();
  }, [filterKey, hasFilter, fetchProductIds]);

  return { productIds, hasFilter, isLoading, error };
}

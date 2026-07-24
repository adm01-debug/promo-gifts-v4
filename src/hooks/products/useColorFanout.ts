/**
 * useColorFanout — Expande produtos em "cards de cor".
 *
 * Diferente do useColorEnrichment (que colapsa cada produto em 1 melhor cor),
 * este hook retorna TODAS as cores selecionadas que cada produto possui, para
 * que o catálogo gere 1 card por (produto, cor) quando o filtro de cor está ativo.
 *
 * Granularidade: por color_id (agrega tamanhos/SKUs da mesma cor → 1 card com
 * estoque somado). Validado em simulação: por color_id = 0 duplicatas; por SKU
 * geraria até 12 cards iguais do mesmo produto.
 *
 * Cadeia de foto por cor (4 níveis): variant_id → color_code → selected_thumbnail
 * → images[]. O 5º nível (foto principal do produto) é aplicado por quem constrói
 * o card, pois depende de campos do Product.
 */
import { getCatalogStockStatus } from '@/lib/catalog-stock-status';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { dbInvoke } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';

export interface ColorCardData {
  colorId: string;
  colorName: string | null;
  colorHex: string | null;
  groupSlug: string | null;
  variationSlug: string | null;
  image: string | null;
  stock: number;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
}

interface UseColorFanoutOptions {
  /** Product IDs to expand (the filtered/visible set) */
  productIds: string[];
  colorGroups: string[];
  colorVariations: string[];
  colorNuances?: string[];
  /** MOQ por produto — variante com stock < MOQ vira out-of-stock */
  productMinQuantities?: Map<string, number>;
}

// Reference tables cached across instances (shared with useColorEnrichment shape)
let cachedGroups: Array<{ id: string; slug: string }> | null = null;
let cachedVariations: Array<{
  id: string;
  name: string;
  slug: string;
  group_id: string;
  nuance_id: string | null;
  hex_code?: string | null;
}> | null = null;
let cachedNuances: Array<{ id: string; slug: string }> | null = null;

/**
 * Returns Map<productId, ColorCardData[]> — one entry per selected color the
 * product has, aggregated by color_id.
 */
export function useColorFanout({
  productIds,
  colorGroups,
  colorVariations,
  colorNuances = [],
  productMinQuantities,
}: UseColorFanoutOptions) {
  const hasFilter =
    colorGroups.length > 0 || colorVariations.length > 0 || colorNuances.length > 0;
  const filterKey = `${[...colorGroups].sort().join(',')}|${[...colorVariations].sort().join(',')}|${[...colorNuances].sort().join(',')}`;
  const idsKey = useMemo(() => [...productIds].sort().join(','), [productIds]);

  const query = useQuery({
    queryKey: ['color-fanout', filterKey, idsKey],
    queryFn: async (): Promise<Map<string, ColorCardData[]>> => {
      const out = new Map<string, ColorCardData[]>();
      if (!hasFilter || productIds.length === 0) return out;

      // Step 1: reference tables (cached)
      const needNuances = colorNuances.length > 0 && !cachedNuances;
      if (!cachedGroups || !cachedVariations || needNuances) {
        const fetches: Promise<unknown>[] = [
          cachedGroups
            ? Promise.resolve({ records: cachedGroups })
            : dbInvoke<{ id: string; slug: string }>({
                table: 'color_groups',
                operation: 'select',
                select: 'id, slug',
                filters: { is_active: true },
                limit: 200,
                offset: 0,
              }),
          cachedVariations
            ? Promise.resolve({ records: cachedVariations })
            : dbInvoke<{
                id: string;
                name: string;
                slug: string;
                group_id: string;
                nuance_id: string | null;
                hex_code: string | null;
              }>({
                table: 'color_variations',
                operation: 'select',
                select: 'id, name, slug, group_id, nuance_id, hex_code',
                filters: { is_active: true },
                limit: 500,
                offset: 0,
              }),
          needNuances
            ? dbInvoke<{ id: string; slug: string }>({
                table: 'color_nuances',
                operation: 'select',
                select: 'id, slug',
                filters: { is_active: true },
                limit: 500,
                offset: 0,
              })
            : Promise.resolve(null),
        ];
        const refs = await Promise.all(fetches);
        cachedGroups = (refs[0] as { records?: typeof cachedGroups } | null)?.records || [];
        cachedVariations = (refs[1] as { records?: typeof cachedVariations } | null)?.records || [];
        if (needNuances) {
          cachedNuances =
            (refs[2] as { records?: Array<{ id: string; slug: string }> } | null)?.records || [];
        }
      }

      const groups = cachedGroups ?? [];
      const variations = cachedVariations ?? [];
      const groupsBySlug = new Map(groups.map((g) => [g.slug, g.id]));
      const groupSlugById = new Map(groups.map((g) => [g.id, g.slug]));
      const variationsBySlug = new Map(variations.map((v) => [v.slug, v]));

      // colorId → metadata (slug do grupo pai + slug da variação)
      const colorMeta = new Map<
        string,
        { variationSlug: string; groupSlug: string | null }
      >();
      for (const v of variations) {
        colorMeta.set(v.id, {
          variationSlug: v.slug,
          groupSlug: groupSlugById.get(v.group_id) ?? null,
        });
      }

      // Step 2: resolver targetColorIds (mesma lógica do enrichment)
      const targetColorIds = new Set<string>();
      for (const slug of colorVariations) {
        const v = variationsBySlug.get(slug);
        if (v) targetColorIds.add(v.id);
      }
      for (const slug of colorGroups) {
        const gid = groupsBySlug.get(slug);
        if (gid) for (const v of variations) if (v.group_id === gid) targetColorIds.add(v.id);
      }
      if (colorNuances.length > 0 && cachedNuances) {
        const nuanceIdBySlug = new Map(cachedNuances.map((n) => [n.slug, n.id]));
        const targetNuanceIds = new Set<string>();
        for (const slug of colorNuances) {
          const nid = nuanceIdBySlug.get(slug);
          if (nid) targetNuanceIds.add(nid);
        }
        for (const v of variations) {
          if (v.nuance_id && targetNuanceIds.has(v.nuance_id)) targetColorIds.add(v.id);
        }
      }
      if (targetColorIds.size === 0) return out;

      // Step 3: variants for these products × target colors
      const colorIdArray = [...targetColorIds];
      const CHUNK = 80;
      const allVariants: Array<{
        id: string;
        product_id: string;
        color_id: string | null;
        color_name: string | null;
        color_hex: string | null;
        color_code: string | null;
        stock_quantity: number | null;
        selected_thumbnail: string | null;
        images: string[] | null;
      }> = [];
      for (let i = 0; i < productIds.length; i += CHUNK) {
        const pidChunk = productIds.slice(i, i + CHUNK);
        const res = await dbInvoke<(typeof allVariants)[number]>({
          table: 'product_variants',
          operation: 'select',
          select:
            'id, product_id, color_id, color_name, color_hex, color_code, stock_quantity, selected_thumbnail, images',
          filters: { is_active: true, product_id: pidChunk, color_id: colorIdArray },
          limit: 3000,
          offset: 0,
        });
        if (res.records?.length) allVariants.push(...res.records);
      }
      if (allVariants.length === 0) return out;

      // Step 4: images for those products
      const pidsWithVariants = [...new Set(allVariants.map((v) => v.product_id))];
      const allImages: Array<{
        product_id: string;
        variant_id: string | null;
        supplier_code: string | null;
        url_cdn: string | null;
        is_og_image: boolean | null;
        is_primary: boolean | null;
        image_type: string | null;
      }> = [];
      for (let i = 0; i < pidsWithVariants.length; i += CHUNK) {
        const pidChunk = pidsWithVariants.slice(i, i + CHUNK);
        const res = await dbInvoke<(typeof allImages)[number]>({
          table: 'product_images',
          operation: 'select',
          select:
            'product_id, variant_id, supplier_code, url_cdn, is_og_image, is_primary, image_type',
          filters: { product_id: pidChunk },
          limit: 3000,
          offset: 0,
        });
        if (res.records?.length) allImages.push(...res.records);
      }

      // image lookup maps (scoped per product)
      const imgByVariantId = new Map<string, string>();
      const imgByProductCode = new Map<string, string>();
      const primaryByProduct = new Map<string, Set<string>>();
      for (const img of allImages) {
        if (!img.url_cdn || img.image_type === 'box') continue;
        if ((img.is_primary || img.is_og_image) && img.url_cdn) {
          if (!primaryByProduct.has(img.product_id)) primaryByProduct.set(img.product_id, new Set());
          primaryByProduct.get(img.product_id)?.add(img.url_cdn);
        }
        if (img.variant_id) {
          if (!imgByVariantId.has(img.variant_id) || img.is_og_image)
            imgByVariantId.set(img.variant_id, img.url_cdn);
        }
        if (img.supplier_code) {
          const key = `${img.product_id}|${img.supplier_code.toUpperCase()}`;
          if (!imgByProductCode.has(key) || img.is_og_image)
            imgByProductCode.set(key, img.url_cdn);
        }
      }

      // Step 5: group variants by (product_id, color_id) → aggregate
      const byProductColor = new Map<string, typeof allVariants>();
      for (const v of allVariants) {
        if (!v.color_id) continue;
        const key = `${v.product_id}|${v.color_id}`;
        if (!byProductColor.has(key)) byProductColor.set(key, []);
        byProductColor.get(key)?.push(v);
      }

      let withImage = 0;
      let withoutImage = 0;
      for (const [key, variants] of byProductColor) {
        const [productId, colorId] = key.split('|');
        const moq = productMinQuantities?.get(productId);

        let totalStock = 0;
        for (const v of variants) totalStock += v.stock_quantity ?? 0;

        // pick best image (4 levels), scoped to this color's variants
        let bestImage: string | null = null;
        for (const v of variants) {
          if (bestImage) break;
          const vi = imgByVariantId.get(v.id) || null;
          if (vi) { bestImage = vi; break; }
          const ci = v.color_code
            ? imgByProductCode.get(`${productId}|${v.color_code.toUpperCase()}`) || null
            : null;
          if (ci) { bestImage = ci; break; }
        }
        if (!bestImage) {
          const primaries = primaryByProduct.get(productId);
          for (const v of variants) {
            if (v.selected_thumbnail && !primaries?.has(v.selected_thumbnail)) {
              bestImage = v.selected_thumbnail; break;
            }
          }
        }
        if (!bestImage) {
          const primaries = primaryByProduct.get(productId);
          for (const v of variants) {
            if (v.images?.length) {
              const valid = v.images.filter((im) => !primaries?.has(im));
              if (valid.length > 0) { bestImage = valid[0]; break; }
              if (v.images.length > 0) { bestImage = v.images[0]; break; }
            }
          }
        }

        if (bestImage) withImage++; else withoutImage++;

        const meta = colorMeta.get(colorId);
        const first = variants[0];
        const card: ColorCardData = {
          colorId,
          colorName: first.color_name,
          colorHex: first.color_hex,
          groupSlug: meta?.groupSlug ?? null,
          variationSlug: meta?.variationSlug ?? null,
          image: bestImage,
          stock: totalStock,
          stockStatus: getCatalogStockStatus(totalStock, undefined, moq),
        };

        if (!out.has(productId)) out.set(productId, []);
        out.get(productId)?.push(card);
      }

      // ordenação estável dos cards dentro de cada produto: por nome da cor
      for (const [, cards] of out) {
        cards.sort((a, b) => (a.colorName ?? '').localeCompare(b.colorName ?? '', 'pt-BR'));
      }

      logger.log(
        `[useColorFanout] ${productIds.length} produtos → ${byProductColor.size} cards | img: ${withImage}, sem img: ${withoutImage}`,
      );
      return out;
    },
    enabled: hasFilter && productIds.length > 0,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return { data: query.data, isLoading: query.isLoading };
}

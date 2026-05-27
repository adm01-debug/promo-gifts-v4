/**
 * Fetch products with full enrichment (colors, images, variants, suppliers).
 */
import { logger } from '@/lib/logger';
import {
  invokeExternalDb,
  invokeBatchBridge,
  type BatchQuery,
  type BatchResult,
  type InvokeResult,
} from './bridge';
import {
  type PromobrindProduct,
  PRODUCT_SELECT_FIELDS_WITH_SALE,
  PRODUCT_SELECT_FIELDS_WITH_SALE_NO_THRESHOLD,
  PRODUCT_SELECT_FIELDS_LEGACY,
  PRODUCT_SELECT_FIELDS_LEGACY_NO_THRESHOLD,
  shouldFallbackSelect,
} from './product-types';

// Row shapes for external_db_bridge results (untyped at runtime; assertions below).
type VariantRow = {
  id: string;
  product_id: string;
  sku?: string | null;
  color_id?: string | null;
  color_name?: string | null;
  color_code?: string | null;
  color_hex?: string | null;
  stock_quantity?: number | null;
  selected_thumbnail?: string | null;
  images?: string[] | null;
};
type ImageRow = {
  product_id: string;
  variant_id: string | null;
  url_cdn: string;
  url_original: string | null;
  filename: string | null;
  image_type: string;
  is_primary: boolean;
  is_og_image: boolean | null;
  applies_to_color: boolean | null;
  display_order: number;
  supplier_code: string | null;
  alt_text: string | null;
  title_text: string | null;
};
type SupplierRow = { id: string; name: string; code: string };
type ColorVariationRow = { id: string; name: string; slug: string; group_id: string };
type ColorGroupRow = { id: string; name: string; slug: string };

export async function fetchPromobrindProducts(options?: {
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, unknown>;
}): Promise<PromobrindProduct[]>;
export async function fetchPromobrindProducts(options?: {
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, unknown>;
  returnCount?: true;
}): Promise<{ products: PromobrindProduct[]; count: number | null }>;
export async function fetchPromobrindProducts(options?: {
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, unknown>;
  returnCount?: boolean;
}): Promise<PromobrindProduct[] | { products: PromobrindProduct[]; count: number | null }> {
  const filters: Record<string, unknown> = {
    ...(options?.filters?.active === undefined && options?.filters?.is_active === undefined
      ? { active: true }
      : {}),
    ...options?.filters,
  };

  if (options?.search) {
    filters._search = options.search;
  }

  const orderBy = options?.orderBy ?? { column: 'name', ascending: true };
  let products: PromobrindProduct[] = [];
  let totalCount: number | null = null;
  const shouldRequestCount = options?.returnCount === true;

  if (typeof options?.limit === 'number' && options.limit > 0) {
    const fetchOffset = options?.offset ?? 0;
    let result: InvokeResult<PromobrindProduct>;
    try {
      result = await invokeExternalDb<PromobrindProduct>({
        table: 'products',
        operation: 'select',
        filters,
        select: PRODUCT_SELECT_FIELDS_WITH_SALE,
        orderBy,
        limit: options.limit,
        offset: fetchOffset,
        countMode: shouldRequestCount ? 'planned' : 'none',
      });
    } catch (err) {
      if (!shouldFallbackSelect(err)) throw err;
      try {
        result = await invokeExternalDb<PromobrindProduct>({
          table: 'products',
          operation: 'select',
          filters,
          select: PRODUCT_SELECT_FIELDS_WITH_SALE_NO_THRESHOLD,
          orderBy,
          limit: options.limit,
          offset: fetchOffset,
          countMode: shouldRequestCount ? 'planned' : 'none',
        });
      } catch (fallbackErr) {
        if (!shouldFallbackSelect(fallbackErr)) throw fallbackErr;
        result = await invokeExternalDb<PromobrindProduct>({
          table: 'products',
          operation: 'select',
          filters,
          select: PRODUCT_SELECT_FIELDS_LEGACY_NO_THRESHOLD,
          orderBy,
          limit: options.limit,
          offset: fetchOffset,
          countMode: shouldRequestCount ? 'planned' : 'none',
        });
      }
    }
    products = result.records;
    totalCount = result.count;
  } else {
    const BASE_PAGE_SIZE = 200;
    let offset = 0;
    let loopCount: number | null = null;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 2; // Reduced from 3 — fail faster
    const HARD_MAX = 200000;
    const PAGINATION_START = Date.now();
    const PAGINATION_TIMEOUT_MS = 30_000; // 30s total budget for full pagination

    while (offset < HARD_MAX) {
      // Time-budget check: stop if we've been paginating too long
      if (Date.now() - PAGINATION_START > PAGINATION_TIMEOUT_MS) {
        logger.warn(
          `[external-db] Pagination time budget exceeded (${PAGINATION_TIMEOUT_MS}ms). Got ${products.length} products at offset=${offset}.`,
        );
        break;
      }

      // Reduce page size aggressively because the external products table is timing out under larger ranges
      const pageSize = offset >= 1000 ? 125 : BASE_PAGE_SIZE;
      const countMode: 'planned' | 'none' = shouldRequestCount && offset === 0 ? 'planned' : 'none';
      let page: InvokeResult<PromobrindProduct>;
      try {
        page = await invokeExternalDb<PromobrindProduct>({
          table: 'products',
          operation: 'select',
          filters,
          select: PRODUCT_SELECT_FIELDS_WITH_SALE,
          orderBy,
          limit: pageSize,
          offset,
          countMode,
        });
        consecutiveErrors = 0;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (
          msg.includes('statement timeout') ||
          msg.includes('57014') ||
          msg.includes('canceling statement')
        ) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            logger.warn(
              `[external-db] Stopping pagination at offset=${offset} after ${MAX_CONSECUTIVE_ERRORS} consecutive timeouts. Got ${products.length} products so far.`,
            );
            break;
          }
          logger.warn(
            `[external-db] Timeout at offset=${offset}, retrying (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})...`,
          );
          await new Promise((r) => setTimeout(r, 1000 * consecutiveErrors));
          continue;
        }
        if (!shouldFallbackSelect(err)) throw err;
        try {
          page = await invokeExternalDb<PromobrindProduct>({
            table: 'products',
            operation: 'select',
            filters,
            select: PRODUCT_SELECT_FIELDS_WITH_SALE_NO_THRESHOLD,
            orderBy,
            limit: pageSize,
            offset,
            countMode,
          });
          consecutiveErrors = 0;
        } catch (fallbackErr: unknown) {
          const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : '';
          if (fbMsg.includes('statement timeout') || fbMsg.includes('canceling statement')) {
            consecutiveErrors++;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              logger.warn(
                `[external-db] Stopping pagination (fallback) at offset=${offset}. Got ${products.length} products.`,
              );
              break;
            }
            await new Promise((r) => setTimeout(r, 1000 * consecutiveErrors));
            continue;
          }
          if (shouldFallbackSelect(fallbackErr)) {
            page = await invokeExternalDb<PromobrindProduct>({
              table: 'products',
              operation: 'select',
              filters,
              select: PRODUCT_SELECT_FIELDS_LEGACY_NO_THRESHOLD,
              orderBy,
              limit: pageSize,
              offset,
              countMode,
            });
            consecutiveErrors = 0;
          } else {
            throw fallbackErr;
          }
        }
      }

      if (!page) break;
      if (typeof page.count === 'number') loopCount = page.count;
      products.push(...page.records);
      offset += page.records.length;
      if (page.records.length < pageSize) break;
      if (loopCount !== null && products.length >= loopCount) break;
    }
    totalCount = loopCount;
  }

  // Enrich products
  if (products.length > 0) {
    await enrichProducts(products, options);
  }

  if (options?.returnCount) {
    return { products, count: totalCount };
  }
  return products;
}

// ============================================
// ENRICHMENT LOGIC
// ============================================

async function enrichProducts(products: PromobrindProduct[], options?: { limit?: number }) {
  const productIds = products.map((p) => p.id);
  const uniqueSupplierIds = [
    ...new Set(products.map((p) => p.supplier_id).filter(Boolean)),
  ] as string[];
  const shouldRunHeavyEnrichment = products.length <= 500 || typeof options?.limit === 'number';

  if (!shouldRunHeavyEnrichment) {
    logger.info(
      `[external-db] Skipping heavy enrichment for ${products.length} products to prevent timeouts`,
    );
  }

  const CHUNK_SIZE = 80;
  const idChunks: string[][] = [];
  for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
    idChunks.push(productIds.slice(i, i + CHUNK_SIZE));
  }

  const batchQueries: BatchQuery[] = [];
  const queryMap: Record<string, number[]> = {
    variants: [],
    images: [],
    suppliers: [],
    colorVariations: [],
    colorGroups: [],
  };

  if (shouldRunHeavyEnrichment) {
    for (const chunk of idChunks) {
      queryMap.variants.push(batchQueries.length);
      batchQueries.push({
        table: 'product_variants',
        select:
          'product_id, color_name, color_hex, color_code, color_id, sku, stock_quantity, images, selected_thumbnail',
        filters: { is_active: true, product_id: chunk },
        limit: 1000,
        offset: 0,
      });
    }
    for (const chunk of idChunks) {
      queryMap.images.push(batchQueries.length);
      batchQueries.push({
        table: 'product_images',
        select:
          'product_id, url_cdn, url_original, filename, image_type, is_primary, is_og_image, applies_to_color, display_order, alt_text, title_text, supplier_code, variant_id',
        filters: { is_active: true, product_id: chunk },
        limit: 1000,
        offset: 0,
      });
    }
    queryMap.colorVariations.push(batchQueries.length);
    batchQueries.push({
      table: 'color_variations',
      select: 'id, name, slug, group_id',
      filters: { is_active: true },
      limit: 500,
      offset: 0,
      cacheKey: 'ref:color_variations',
    });
    queryMap.colorGroups.push(batchQueries.length);
    batchQueries.push({
      table: 'color_groups',
      select: 'id, name, slug',
      filters: { is_active: true },
      limit: 100,
      offset: 0,
      cacheKey: 'ref:color_groups',
    });
  }

  if (uniqueSupplierIds.length > 0) {
    queryMap.suppliers.push(batchQueries.length);
    batchQueries.push({
      table: 'suppliers',
      select: 'id, name, code',
      filters: { id: uniqueSupplierIds },
      limit: Math.max(uniqueSupplierIds.length, 1),
      offset: 0,
    });
  }

  let batchResults: BatchResult[] = [];
  try {
    batchResults = await invokeBatchBridge(batchQueries);
  } catch (err) {
    logger.warn('[external-db] Batch enrichment failed, products will have basic data:', err);
    return;
  }

  // Extract results
  const variantsRecords: VariantRow[] = [];
  for (const idx of queryMap.variants) {
    const r = batchResults[idx];
    if (r?.success && r.data?.records) variantsRecords.push(...(r.data.records as VariantRow[]));
  }
  const imagesRecords: ImageRow[] = [];
  for (const idx of queryMap.images) {
    const r = batchResults[idx];
    if (r?.success && r.data?.records) imagesRecords.push(...(r.data.records as ImageRow[]));
  }
  const suppliersRecords: SupplierRow[] = [];
  for (const idx of queryMap.suppliers) {
    const r = batchResults[idx];
    if (r?.success && r.data?.records) suppliersRecords.push(...(r.data.records as SupplierRow[]));
  }

  let colorVariationsRecords: ColorVariationRow[] = [];
  for (const idx of queryMap.colorVariations) {
    const r = batchResults[idx];
    if (r?.success && r.data?.records)
      colorVariationsRecords = r.data.records as ColorVariationRow[];
  }
  let colorGroupsRecords: ColorGroupRow[] = [];
  for (const idx of queryMap.colorGroups) {
    const r = batchResults[idx];
    if (r?.success && r.data?.records) colorGroupsRecords = r.data.records as ColorGroupRow[];
  }

  const suppliersMap = new Map(suppliersRecords.map((s) => [s.id, s.name]));
  // Popula cache de imutáveis para reaproveitar em telas de detalhe sem ida ao bridge.
  try {
    const { putInCacheSafe } = await import('./immutableCache');
    for (const s of suppliersRecords) {
      if (s?.id && s?.name) putInCacheSafe('suppliers', { id: s.id, name: s.name, code: s.code });
    }
  } catch {
    /* cache populate is best-effort */
  }
  const colorVariationMap = new Map(
    colorVariationsRecords.map((v) => [v.id, { name: v.name, slug: v.slug, group_id: v.group_id }]),
  );
  const colorGroupMap = new Map(
    colorGroupsRecords.map((g) => [g.id, { name: g.name, slug: g.slug }]),
  );

  // Build image map
  const productIdSet = new Set(productIds);
  const imagesByProduct = new Map<
    string,
    Array<{
      url: string;
      urlOriginal: string | null;
      filename: string | null;
      type: string;
      isPrimary: boolean;
      isOgImage: boolean;
      appliesToColor: boolean | null;
      order: number;
      supplierCode: string | null;
      altText: string | null;
      titleText: string | null;
      variantId: string | null;
    }>
  >();

  imagesRecords.forEach((img) => {
    if (!productIdSet.has(img.product_id)) return;
    const productImages = imagesByProduct.get(img.product_id) ?? [];
    imagesByProduct.set(img.product_id, productImages);
    productImages.push({
      url: img.url_cdn,
      urlOriginal: img.url_original || null,
      filename: img.filename || null,
      type: img.image_type,
      isPrimary: img.is_primary,
      isOgImage: img.is_og_image || false,
      appliesToColor: img.applies_to_color ?? null,
      order: img.display_order,
      supplierCode: img.supplier_code || null,
      altText: img.alt_text || null,
      titleText: img.title_text || null,
      variantId: img.variant_id || null,
    });
  });

  // Build color map
  const colorsByProduct = new Map<
    string,
    Array<{
      name: string;
      hex: string;
      code: string;
      sku?: string;
      stock?: number;
      image?: string;
      images?: string[];
      groupSlug?: string;
      groupName?: string;
      variationSlug?: string;
    }>
  >();

  variantsRecords.forEach((variant) => {
    if (!variant.color_name || !productIds.includes(variant.product_id)) return;
    const colors = colorsByProduct.get(variant.product_id) ?? [];
    colorsByProduct.set(variant.product_id, colors);
    if (colors.some((c) => c.name === variant.color_name)) return;

    const productImgs = imagesByProduct.get(variant.product_id) || [];
    const byVariantId = productImgs
      .filter((img) => img.variantId === variant.id && !img.isPrimary && !img.isOgImage)
      .sort((a, b) => a.order - b.order)
      .map((img) => img.url);
    const byCode = variant.color_code
      ? productImgs
          .filter(
            (img) => img.supplierCode === variant.color_code && !img.isPrimary && !img.isOgImage,
          )
          .sort((a, b) => a.order - b.order)
          .map((img) => img.url)
      : [];
    const allById =
      byVariantId.length === 0
        ? productImgs
            .filter((img) => img.variantId === variant.id)
            .sort((a, b) => a.order - b.order)
            .map((img) => img.url)
        : [];
    const legacy = variant.images?.length ? variant.images : [];
    const finalImages =
      byVariantId.length > 0
        ? byVariantId
        : byCode.length > 0
          ? byCode
          : allById.length > 0
            ? allById
            : legacy;
    const thumbnailImage = finalImages[0] || variant.selected_thumbnail || null;

    let groupSlug: string | undefined,
      groupName: string | undefined,
      variationSlug: string | undefined;
    if (variant.color_id) {
      const variation = colorVariationMap.get(variant.color_id);
      if (variation) {
        variationSlug = variation.slug;
        const group = colorGroupMap.get(variation.group_id);
        if (group) {
          groupSlug = group.slug;
          groupName = group.name;
        }
      }
    }

    colors.push({
      name: variant.color_name,
      hex: variant.color_hex || '#CCCCCC',
      code: variant.color_code || '',
      sku: variant.sku || undefined,
      stock: variant.stock_quantity ?? undefined,
      image: thumbnailImage || undefined,
      images: finalImages.length > 0 ? finalImages : undefined,
      groupSlug,
      groupName,
      variationSlug,
    });
  });

  // Apply enrichments to products
  products.forEach((product) => {
    const productImages = imagesByProduct.get(product.id);
    if (productImages && productImages.length > 0) {
      productImages.sort((a, b) => a.order - b.order);
      const colorImages = productImages.filter((img) => img.supplierCode && img.type !== 'box');
      const generalImages = productImages.filter((img) => !img.supplierCode && img.type !== 'box');
      const mainImages = [...colorImages, ...generalImages];
      const primaryImage = mainImages.find((img) => img.isPrimary) || mainImages[0];
      if (primaryImage) {
        product.primary_image_url = primaryImage.url;
        product.image_url = primaryImage.url;
      }
      const ogImage =
        mainImages.find((img) => img.isOgImage) ||
        mainImages.find((img) => img.type === 'main') ||
        primaryImage;
      if (ogImage) product.og_image_url = ogImage.url;
      product.images = mainImages.map((img) => img.url);
    }
    const variantColors = colorsByProduct.get(product.id);
    if (variantColors?.length) product.colors = variantColors;
    if (product.supplier_id && suppliersMap.has(product.supplier_id)) {
      product.supplier_name = suppliersMap.get(product.supplier_id);
    }
  });
}

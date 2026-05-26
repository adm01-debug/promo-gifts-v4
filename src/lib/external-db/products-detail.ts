/**
 * Product detail fetching — fetchById, bySku, categories, colors.
 */
import { logger } from '@/lib/logger';
import { invokeExternalDb, invokeBatchBridge, type InvokeResult, type BatchQuery } from './bridge';
import { getCachedByIds, getFreshFromCacheSafe, putInCacheSafe } from './immutableCache';
import {
  type PromobrindProduct,
  PRODUCT_SELECT_FIELDS_WITH_SALE,
  PRODUCT_SELECT_FIELDS_LEGACY,
  PRODUCT_SELECT_FIELDS_DETAIL,
  shouldFallbackSelect,
} from './product-types';

async function fetchProductWithRetry(
  productId: string,
  maxRetries = 2,
): Promise<InvokeResult<PromobrindProduct>> {
  const selectFields = [
    PRODUCT_SELECT_FIELDS_DETAIL,
    PRODUCT_SELECT_FIELDS_WITH_SALE,
    PRODUCT_SELECT_FIELDS_LEGACY,
  ];
  let lastError: unknown;
  for (let selectIdx = 0; selectIdx < selectFields.length; selectIdx++) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await invokeExternalDb<PromobrindProduct>({
          table: 'products',
          operation: 'select',
          filters: { id: productId },
          select: selectFields[selectIdx],
          limit: 1,
        });
      } catch (err) {
        lastError = err;
        if (shouldFallbackSelect(err)) break; // try next select fields
        if (isTransientError(err) && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        if (!isTransientError(err)) throw err;
      }
    }
  }
  throw lastError;
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /(timeout|statement timeout|canceling statement|schema cache|retrying|ECONNRESET|fetch failed)/i.test(
    msg,
  );
}

export async function fetchPromobrindProductById(
  productId: string,
): Promise<PromobrindProduct | null> {
  const result = await fetchProductWithRetry(productId);

  const product = result.records[0] || null;
  if (!product) return null;

  if (!product.description && product.meta_description) {
    product.description = product.meta_description;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Paralelização: as 4 famílias de fetch dependem só de `productId` (e do
  // próprio `product` já carregado), então podem ir juntas em vez de em
  // série. Cada chamada continua propagando seu próprio request-id via
  // invokeExternalDb / invokeBatchBridge — a rastreabilidade no painel de
  // telemetria fica preservada (1 req_id por linha do timeline).
  //
  // Etapas:
  //   A) product_images
  //   B) batch enrichment (categories + suppliers + product_materials)
  //   C) product_variants
  //   D) product_videos
  //   E) product_kit_components (apenas se is_kit)
  //
  // material_types continua em série, pois depende do resultado de (B).
  // O pós-processamento de variants depende de (A) p/ resolver imagens por
  // color_code → fazemos o merge depois do Promise.all.
  // ─────────────────────────────────────────────────────────────────────

  type ProductImage = {
    url_cdn: string;
    url_original: string | null;
    filename: string | null;
    image_type: string;
    is_primary: boolean;
    is_og_image: boolean;
    applies_to_color: boolean | null;
    display_order: number;
    alt_text: string | null;
    title_text: string | null;
    supplier_code: string | null;
  };

  // ─── (A) Imagens ─────────────────────────────────────────────────────
  // Limite reduzido de 200 → 80: cobre folgadamente cores (1 supplier_code ×
  // poucas fotos) + galeria geral. Se atingir o teto, fazemos uma 2ª página
  // sob demanda (raro). Payload típico cai ~60% para produtos com muitas cores.
  const IMAGES_PAGE = 80;
  const imagesPromise = invokeExternalDb<ProductImage>({
    table: 'product_images',
    operation: 'select',
    select:
      'url_cdn, url_original, filename, image_type, is_primary, is_og_image, applies_to_color, display_order, alt_text, title_text, supplier_code',
    filters: { product_id: productId, is_active: true },
    orderBy: { column: 'display_order', ascending: true },
    limit: IMAGES_PAGE,
  })
    .then((r) => r.records)
    .catch((err) => {
      logger.warn(`[product:${productId}] Não foi possível buscar imagens:`, err);
      return [] as ProductImage[];
    });

  // ─── (B) Enrichment (cat/supplier/materials) em batch + cache ────────
  const categoryId = product.category_id || product.main_category_id;
  const needsCategory = !!categoryId && !product.category_name;
  const needsSupplier = !!product.supplier_id;
  const needsMaterials =
    !product.materials || (Array.isArray(product.materials) && product.materials.length === 0);

  if (needsCategory && categoryId) {
    const cached = getFreshFromCacheSafe('categories', categoryId);
    if (cached?.name) product.category_name = cached.name;
  }
  if (needsSupplier && product.supplier_id) {
    const cached = getFreshFromCacheSafe('suppliers', product.supplier_id);
    if (cached?.name) product.supplier_name = cached.name;
  }

  const stillNeedsCategory = !!categoryId && !product.category_name;
  const stillNeedsSupplier = !!product.supplier_id && !product.supplier_name;

  const enrichmentQueries: BatchQuery[] = [];
  const enrichmentSlots: Array<'category' | 'supplier' | 'materials'> = [];

  if (stillNeedsCategory) {
    enrichmentQueries.push({
      table: 'categories',
      select: 'id, name',
      filters: { id: categoryId as string },
      limit: 1,
    });
    enrichmentSlots.push('category');
  }
  if (stillNeedsSupplier) {
    enrichmentQueries.push({
      table: 'suppliers',
      select: 'id, name, code',
      filters: { id: product.supplier_id as string },
      limit: 1,
    });
    enrichmentSlots.push('supplier');
  }
  if (needsMaterials) {
    enrichmentQueries.push({
      table: 'product_materials',
      select: 'product_id, material_id, part',
      filters: { product_id: productId, is_active: true },
      limit: 20,
    });
    enrichmentSlots.push('materials');
  }

  const enrichmentPromise: Promise<{ materialIds: string[] }> =
    enrichmentQueries.length === 0
      ? Promise.resolve({ materialIds: [] })
      : invokeBatchBridge(enrichmentQueries)
          .then((batchResults) => {
            const materialIds: string[] = [];
            enrichmentSlots.forEach((slot, idx) => {
              const r = batchResults[idx];
              if (!r?.success || !r.data) return;
              const records = r.data.records;
              if (slot === 'category') {
                const rec = records[0] as { id?: string; name?: string } | undefined;
                if (rec?.name) {
                  product.category_name = rec.name;
                  if (rec.id) putInCacheSafe('categories', { id: rec.id, name: rec.name });
                }
              } else if (slot === 'supplier') {
                const rec = records[0] as { id?: string; name?: string; code?: string } | undefined;
                if (rec?.name) {
                  product.supplier_name = rec.name;
                  if (rec.id)
                    putInCacheSafe('suppliers', { id: rec.id, name: rec.name, code: rec.code });
                }
              } else if (slot === 'materials') {
                const matRecs = records as Array<{ material_id: string }>;
                const seen = new Set<string>();
                for (const m of matRecs) {
                  if (m.material_id && !seen.has(m.material_id)) {
                    seen.add(m.material_id);
                    materialIds.push(m.material_id);
                  }
                }
              }
            });
            return { materialIds };
          })
          .catch((err) => {
            logger.warn(`[product:${productId}] Não foi possível enriquecer em lote:`, err);
            return { materialIds: [] };
          });

  // ─── (C) Variantes (cores) ───────────────────────────────────────────
  // ─── (C) Variantes (cores) ───────────────────────────────────────────
  // Fetch ENXUTO: NÃO traz `images` (text[] potencialmente grande) nem
  // `selected_thumbnail` por padrão — esses campos só são necessários como
  // FALLBACK para variantes cujas imagens não foram cobertas por
  // `supplier_code` em `product_images` (caso atípico). Buscamos esses
  // campos sob demanda em UMA chamada extra (id=in.(...)) só para quem
  // realmente precisar, depois do merge inicial.
  //
  // Limite 100 → 60: dedupe por color_name raramente excede 20–30; 60
  // dá folga para kits sem inflar payload.
  type Variant = {
    id: string;
    color_name: string | null;
    color_hex: string | null;
    color_code: string | null;
    sku: string | null;
    stock_quantity: number | null;
  };
  const variantsPromise = invokeExternalDb<Variant>({
    table: 'product_variants',
    operation: 'select',
    select: 'id, color_name, color_hex, color_code, sku, stock_quantity',
    filters: { product_id: productId, is_active: true },
    limit: 60,
  })
    .then((r) => r.records)
    .catch((err) => {
      logger.warn(`[product:${productId}] Não foi possível buscar variantes:`, err);
      return [] as Variant[];
    });

  // ─── (D) Vídeos ──────────────────────────────────────────────────────
  type Video = {
    id: string;
    url_stream: string | null;
    url_hls: string | null;
    url_thumbnail: string | null;
    url_original: string | null;
    source_youtube_id: string | null;
    video_type: string | null;
    display_order: number;
    is_primary: boolean;
    title: string | null;
    cloudflare_status: string | null;
  };
  const videosPromise = invokeExternalDb<Video>({
    table: 'product_videos',
    operation: 'select',
    select:
      'id, url_stream, url_hls, url_thumbnail, url_original, source_youtube_id, video_type, display_order, is_primary, title, cloudflare_status',
    filters: { product_id: productId, is_active: true },
    orderBy: { column: 'display_order', ascending: true },
    limit: 20,
  })
    .then((r) => r.records)
    .catch((err) => {
      logger.warn(`[product:${productId}] Não foi possível buscar vídeos:`, err);
      return [] as Video[];
    });

  // ─── (E) Componentes do kit (condicional) ────────────────────────────
  type KitComponent = {
    id: string;
    component_name: string | null;
    component_code: string | null;
    component_product_id: string | null;
    component_sku: string | null;
    quantity: number | null;
    display_order: number | null;
    is_optional: boolean | null;
    is_packaging: boolean | null;
    is_replaceable: boolean | null;
    allows_personalization: boolean | null;
    material: string | null;
    primary_image_url: string | null;
    height_mm: number | null;
    width_mm: number | null;
    length_mm: number | null;
    weight_g: number | null;
    notes: string | null;
  };
  const kitPromise: Promise<KitComponent[]> = product.is_kit
    ? invokeExternalDb<KitComponent>({
        table: 'product_kit_components',
        operation: 'select',
        select:
          'id, component_name, component_code, component_product_id, component_sku, quantity, display_order, is_optional, is_packaging, is_replaceable, allows_personalization, material, primary_image_url, height_mm, width_mm, length_mm, weight_g, notes',
        filters: { kit_product_id: productId },
        orderBy: { column: 'display_order', ascending: true },
        limit: 50,
      })
        .then((r) => r.records)
        .catch((err) => {
          logger.warn(`[product:${productId}] Não foi possível buscar componentes do kit:`, err);
          return [] as KitComponent[];
        })
    : Promise.resolve([]);

  // Dispara TUDO em paralelo
  const [allProductImages, enrichment, variants, videos, kitComponents] = await Promise.all([
    imagesPromise,
    enrichmentPromise,
    variantsPromise,
    videosPromise,
    kitPromise,
  ]);

  // ─── Pós-processamento (ordem importa apenas localmente) ─────────────

  // Imagens → primary/og/lista
  // Se atingimos exatamente o teto da página, complementa com 1 página extra
  // (raríssimo). Mantém a quebra suave sem trazer 200 por padrão.
  let imagesAll: ProductImage[] = allProductImages;
  if (allProductImages.length === IMAGES_PAGE) {
    try {
      const more = await invokeExternalDb<ProductImage>({
        table: 'product_images',
        operation: 'select',
        select:
          'url_cdn, url_original, filename, image_type, is_primary, is_og_image, applies_to_color, display_order, alt_text, title_text, supplier_code',
        filters: { product_id: productId, is_active: true },
        orderBy: { column: 'display_order', ascending: true },
        limit: IMAGES_PAGE,
        offset: IMAGES_PAGE,
      });
      if (more.records.length > 0) imagesAll = [...allProductImages, ...more.records];
    } catch (err) {
      logger.warn(`[product:${productId}] Falha paginando imagens (página 2):`, err);
    }
  }
  if (imagesAll.length > 0) {
    const colorImages = imagesAll
      .filter((img) => img.supplier_code && img.image_type !== 'box')
      .sort((a, b) => a.display_order - b.display_order);
    const generalImages = imagesAll
      .filter((img) => !img.supplier_code && img.image_type !== 'box')
      .sort((a, b) => a.display_order - b.display_order);
    const mainImages = [...colorImages, ...generalImages];
    const primaryImage = mainImages.find((img) => img.is_primary) || mainImages[0];
    if (primaryImage) {
      product.primary_image_url = primaryImage.url_cdn;
      product.image_url = primaryImage.url_cdn;
    }
    const ogImage =
      mainImages.find((img) => img.is_og_image) ||
      mainImages.find((img) => img.image_type === 'main') ||
      primaryImage;
    if (ogImage) product.og_image_url = ogImage.url_cdn;
    product.images = mainImages.map((img) => img.url_cdn);
  }

  // material_types — depende do enrichment, em série (1 chamada extra ou cache)
  if (enrichment.materialIds.length > 0) {
    try {
      const nameById = await getCachedByIds<{ id: string; name: string }>(
        'material_types',
        enrichment.materialIds,
      );
      const materialNames = enrichment.materialIds
        .map((id) => nameById.get(id)?.name)
        .filter((n): n is string => !!n);
      if (materialNames.length > 0) product.materials = materialNames;
    } catch (err) {
      logger.warn(`[product:${productId}] Não foi possível buscar nomes de material_types:`, err);
    }
  }

  // Variants → cores únicas. byCode (via product_images.supplier_code) cobre o
  // caso comum SEM precisar dos campos pesados do variant. Para variantes
  // sem cobertura, fazemos 1 ÚNICO fetch lazy buscando `images` +
  // `selected_thumbnail` apenas dos ids necessários.
  if (variants.length > 0) {
    type ColorEntry = {
      name: string;
      hex: string;
      code?: string;
      sku?: string;
      stock?: number;
      image?: string;
      images?: string[];
      _variantId?: string;
      _needsFallback?: boolean;
    };
    const uniqueColors: ColorEntry[] = [];
    const fallbackVariantIds: string[] = [];

    variants.forEach((variant) => {
      if (variant.color_name && !uniqueColors.some((c) => c.name === variant.color_name)) {
        const byCode = variant.color_code
          ? imagesAll
              .filter((img) => img.supplier_code === variant.color_code)
              .sort((a, b) => a.display_order - b.display_order)
              .map((img) => img.url_cdn)
          : [];
        const finalImages = byCode;
        const thumb = finalImages[0] || product.primary_image_url || product.image_url || null;
        const entry: ColorEntry = {
          name: variant.color_name,
          hex: variant.color_hex || '#CCCCCC',
          code: variant.color_code || '',
          sku: variant.sku || undefined,
          stock: variant.stock_quantity ?? undefined,
          image: thumb || undefined,
          images: finalImages.length > 0 ? finalImages : undefined,
        };
        if (finalImages.length === 0) {
          entry._variantId = variant.id;
          entry._needsFallback = true;
          fallbackVariantIds.push(variant.id);
        }
        uniqueColors.push(entry);
      }
    });

    // Fallback lazy: busca images/selected_thumbnail só dos variants que
    // realmente ficaram sem cobertura por supplier_code (caso atípico).
    if (fallbackVariantIds.length > 0) {
      try {
        const inFilter = `in.(${fallbackVariantIds.join(',')})`;
        const fb = await invokeExternalDb<{
          id: string;
          images: string[] | null;
          selected_thumbnail: string | null;
        }>({
          table: 'product_variants',
          operation: 'select',
          select: 'id, images, selected_thumbnail',
          filters: { id: inFilter },
          limit: Math.max(fallbackVariantIds.length, 10),
        });
        const byId = new Map(fb.records.map((r) => [r.id, r]));
        for (const c of uniqueColors) {
          if (!c._needsFallback || !c._variantId) continue;
          const r = byId.get(c._variantId);
          if (!r) continue;
          const legacy = r.images?.length ? r.images : [];
          const thumb = legacy[0] || r.selected_thumbnail || c.image || null;
          if (legacy.length > 0) c.images = legacy;
          if (thumb) c.image = thumb;
        }
      } catch (err) {
        logger.warn(`[product:${productId}] Fallback de imagens de variantes falhou:`, err);
      }
    }

    if (uniqueColors.length > 0) {
      product.colors = uniqueColors.map(({ _variantId: _v, _needsFallback: _n, ...rest }) => rest);
    }
  }

  // Videos
  if (videos.length > 0) {
    product.product_videos = videos
      .filter((v) => !v.cloudflare_status || v.cloudflare_status === 'ready')
      .map((v) => ({
        id: v.id,
        url_stream: v.url_stream,
        url_hls: v.url_hls,
        url_thumbnail: v.url_thumbnail,
        url_original: v.url_original,
        source_youtube_id: v.source_youtube_id,
        video_type: v.video_type,
        display_order: v.display_order,
        is_primary: v.is_primary,
        title: v.title,
      }));
  }

  // Kit components
  if (kitComponents.length > 0) {
    product.kit_components = kitComponents;
  }

  return product;
}

export async function fetchPromobrindProductBySku(sku: string): Promise<PromobrindProduct | null> {
  let result: InvokeResult<PromobrindProduct>;
  try {
    result = await invokeExternalDb<PromobrindProduct>({
      table: 'products',
      operation: 'select',
      filters: { sku },
      select: PRODUCT_SELECT_FIELDS_WITH_SALE,
      limit: 1,
    });
  } catch (err) {
    if (!shouldFallbackSelect(err)) throw err;
    result = await invokeExternalDb<PromobrindProduct>({
      table: 'products',
      operation: 'select',
      filters: { sku },
      select: PRODUCT_SELECT_FIELDS_LEGACY,
      limit: 1,
    });
  }
  return result.records[0] || null;
}

export async function fetchPromobrindCategories(): Promise<{ id: string; name: string }[]> {
  try {
    const result = await invokeExternalDb<{ id: string; name: string }>({
      table: 'categories',
      operation: 'select',
      select: 'id, name',
      limit: 500,
      orderBy: { column: 'name', ascending: true },
      countMode: 'none',
    });
    // Popula cache de imutáveis: economiza chamadas posteriores em telas de detalhe.
    for (const c of result.records) {
      if (c?.id && c?.name) putInCacheSafe('categories', { id: c.id, name: c.name });
    }
    return result.records;
  } catch {
    const result = await invokeExternalDb<{ category_id: string; main_category_id: string }>({
      table: 'products',
      operation: 'select',
      filters: { active: true },
      select: 'category_id, main_category_id',
      limit: 1000,
    });
    const uniqueIds = new Set<string>();
    result.records.forEach((p) => {
      if (p.category_id) uniqueIds.add(p.category_id);
      if (p.main_category_id) uniqueIds.add(p.main_category_id);
    });
    return Array.from(uniqueIds).map((id) => ({ id, name: id }));
  }
}

export async function fetchPromobrindColors(): Promise<
  { name: string; hex: string; group?: string }[]
> {
  try {
    const result = await invokeExternalDb<{
      color_name: string | null;
      color_hex: string | null;
      color_code: string | null;
    }>({
      table: 'product_variants',
      operation: 'select',
      select: 'color_name, color_hex, color_code',
      filters: { is_active: true },
      limit: 5000,
    });
    const uniqueColors = new Map<string, { name: string; hex: string; group?: string }>();
    result.records.forEach((variant) => {
      if (variant.color_name && !uniqueColors.has(variant.color_name)) {
        uniqueColors.set(variant.color_name, {
          name: variant.color_name,
          hex: variant.color_hex || '#CCCCCC',
        });
      }
    });
    return Array.from(uniqueColors.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  } catch (err) {
    logger.warn('Erro ao buscar cores das variantes:', err);
    return [];
  }
}

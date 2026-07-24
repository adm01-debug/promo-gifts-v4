/**
 * Product detail fetching — fetchById, bySku, categories, colors.
 */
import { dbInvoke, type InvokeOptions, type InvokeResult } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';
import { toErrorMessage } from '@/lib/to-error-message';
import { getCachedByIds, getFreshFromCacheSafe, putInCacheSafe } from './immutableCache';
import { computeKitCoverage } from './kit-coverage';
import {
  type PromobrindProduct,
  PRODUCT_SELECT_FIELDS_WITH_SALE,
  PRODUCT_SELECT_FIELDS_WITH_SALE_NO_THRESHOLD,
  PRODUCT_SELECT_FIELDS_LEGACY,
  PRODUCT_SELECT_FIELDS_LEGACY_NO_THRESHOLD,
  PRODUCT_SELECT_FIELDS_DETAIL,
  PRODUCT_SELECT_FIELDS_DETAIL_NO_THRESHOLD,
  shouldFallbackSelect,
} from './product-types';
import { TECHNICAL_IMAGE_TYPES } from '@/utils/image-utils';

async function fetchProductWithRetry(
  productId: string,
  maxRetries = 2,
): Promise<InvokeResult<PromobrindProduct>> {
  const selectFields = [
    // Full row first: the admin edit form round-trips ~90 columns and writes them all
    // back, so it MUST load the complete record — otherwise unselected columns (ncm,
    // fiscal, SEO, internal dims, packaging, marketing, flags…) would be overwritten
    // with nulls on save. v_products_public is a 1:1 projection, so '*' is the full row.
    '*',
    PRODUCT_SELECT_FIELDS_DETAIL,
    PRODUCT_SELECT_FIELDS_DETAIL_NO_THRESHOLD,
    PRODUCT_SELECT_FIELDS_WITH_SALE,
    PRODUCT_SELECT_FIELDS_WITH_SALE_NO_THRESHOLD,
    PRODUCT_SELECT_FIELDS_LEGACY,
    PRODUCT_SELECT_FIELDS_LEGACY_NO_THRESHOLD,
  ];
  let lastError: unknown;
  for (const selectField of selectFields) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await dbInvoke<PromobrindProduct>({
          table: 'products',
          operation: 'select',
          filters: { id: productId },
          select: selectField,
          limit: 1,
        });
      } catch (err) {
        lastError = err;
        if (shouldFallbackSelect(err)) break; // try next select fields
        if (isTransientError(err) && attempt < maxRetries) {
          await new Promise((r) => {
            setTimeout(r, 1000 * (attempt + 1));
          });
          continue;
        }
        if (!isTransientError(err)) throw err;
      }
    }
  }
  throw lastError;
}

function isTransientError(err: unknown): boolean {
  const msg = toErrorMessage(err);
  return /(timeout|statement timeout|canceling statement|schema cache|retrying|ECONNRESET|fetch failed)/i.test(
    msg,
  );
}

export async function fetchPromobrindProductById(
  productId: string,
): Promise<PromobrindProduct | null> {
  const result = await fetchProductWithRetry(productId);

  const product = result?.records?.[0] || null;
  if (!product) return null;

  if (!product.description && product.meta_description) {
    product.description = product.meta_description;
  }

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

  const IMAGES_PAGE = 80;
  const imagesPromise = dbInvoke<ProductImage>({
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

  const enrichmentQueries: InvokeOptions[] = [];
  const enrichmentSlots: Array<'category' | 'materials' | 'supplier'> = [];

  if (stillNeedsCategory) {
    enrichmentQueries.push({
      table: 'categories',
      operation: 'select',
      select: 'id, name',
      filters: { id: categoryId as string },
      limit: 1,
    });
    enrichmentSlots.push('category');
  }
  if (stillNeedsSupplier) {
    enrichmentQueries.push({
      table: 'suppliers',
      operation: 'select',
      select: 'id, name, code',
      filters: { id: product.supplier_id! },
      limit: 1,
    });
    enrichmentSlots.push('supplier');
  }
  if (needsMaterials) {
    enrichmentQueries.push({
      table: 'product_materials',
      operation: 'select',
      select: 'product_id, material_id, part',
      filters: { product_id: productId, is_active: true },
      limit: 20,
    });
    enrichmentSlots.push('materials');
  }

  const enrichmentPromise: Promise<{ materialIds: string[] }> =
    enrichmentQueries.length === 0
      ? Promise.resolve({ materialIds: [] })
      : Promise.all(enrichmentQueries.map((q) => dbInvoke<unknown>(q)))
          .then((batchResults) => {
            const materialIds: string[] = [];
            enrichmentSlots.forEach((slot, idx) => {
              const r = batchResults[idx];
              if (!r) return;
              const records = r.records;
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

  type Variant = {
    id: string;
    color_name: string | null;
    color_hex: string | null;
    color_code: string | null;
    // fix_version: pdp_sku_badge_v2 — color_id adicionado para lookup de
    // color_variations.internal_code (ex: '11.2') usado no badge SKU para XBZ.
    color_id: string | null;
    sku: string | null;
    stock_quantity: number | null;
  };
  // fix_version: variant_limit_120_20260628
  // Aumento de 60 → 120: o produto STRICKER com mais variantes tem 100 (cor×tamanho).
  // Com limit=60, 8 das 20 cores de camisetas STRICKER (30504/30508/30512) ficavam
  // invisíveis na PDP. Max real observado no catálogo = 100. Margem 20% = 120.
  // Anti-regressão: NÃO reduzir abaixo de 120 sem auditoria prévia do catálogo.
  const variantsPromise = dbInvoke<Variant>({
    table: 'product_variants',
    operation: 'select',
    select: 'id, color_name, color_hex, color_code, color_id, sku, stock_quantity',
    filters: { product_id: productId, is_active: true },
    limit: 120,
  })
    .then((r) => r.records)
    .catch((err) => {
      logger.warn(`[product:${productId}] Não foi possível buscar variantes:`, err);
      return [] as Variant[];
    });

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
  const videosPromise = dbInvoke<Video>({
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

  // Schema validado: product_kit_components tem 26 campos (ver DOC_product_kit_components_COMPLETO.md).
  // Para kits NATIVOS (component_product_id = NULL), TODOS os atributos vivem nesta tabela.
  type KitComponent = {
    id: string;
    component_name: string | null;
    component_code: string | null;
    component_product_id: string | null;
    component_sku: string | null;
    component_description: string | null;
    quantity: number | null;
    display_order: number | null;
    is_optional: boolean | null;
    is_packaging: boolean | null;
    is_replaceable: boolean | null;
    allows_personalization: boolean | null;
    personalization_notes: string | null;
    material: string | null;
    color: string | null;
    primary_image_url: string | null;
    primary_image_fallback_url?: string | null;
    images: unknown | null; // jsonb[] — galeria de fotos do componente
    height_mm: number | null;
    width_mm: number | null;
    length_mm: number | null;
    diameter_mm: number | null;
    circumference_mm: number | null;
    weight_g: number | null;
    capacity_ml: number | null;
    supplier_component_code: string | null;
    component_type_code: string | null;
    notes: string | null;
  };
  // Estratégia: tenta `v_kit_component_complete` (view enriquecida com JOINs de
  // enrichment_raw + media_public + typical_dims + types). Se vazia ou falhar,
  // cai para a tabela base `product_kit_components` (26 campos crus).
  const fetchKitFromView = (): Promise<KitComponent[]> =>
    dbInvoke<KitComponent>({
      table: 'v_kit_component_complete',
      operation: 'select',
      select: '*',
      filters: { kit_product_id: productId },
      orderBy: { column: 'display_order', ascending: true },
      limit: 200,
    }).then((r) => r.records);

  const fetchKitFromBase = (): Promise<KitComponent[]> =>
    dbInvoke<KitComponent>({
      table: 'product_kit_components',
      operation: 'select',
      select:
        // FIX 2026-06-27: capacity_ml não existe em product_kit_components (42703) → removido do select.
        // Se a coluna for adicionada no futuro via migration, incluí-la novamente aqui e em KIT_AUDITED_FIELDS.
        'id, component_name, component_code, component_product_id, component_sku, component_description, quantity, display_order, is_optional, is_packaging, is_replaceable, allows_personalization, personalization_notes, material, color, primary_image_url, images, height_mm, width_mm, length_mm, diameter_mm, circumference_mm, weight_g, supplier_component_code, component_type_code, notes',
      filters: { kit_product_id: productId },
      orderBy: { column: 'display_order', ascending: true },
      limit: 200,
    }).then((r) => r.records);

  // Campos críticos auditados em todo fetch de kit (view OU base).
  // Lógica pura extraída para `./kit-coverage.ts` (testável sem rede/bridge).
  const auditKitFields = (source: 'base' | 'view', rows: KitComponent[]): void => {
    if (rows.length === 0) return;
    const report = computeKitCoverage(rows as unknown as Array<Record<string, unknown>>);
    logger.info(
      `[product:${productId}] kit-components source=${source} rows=${report.rows} ` +
        `avg=${report.avgPct}% fully_null=[${report.fullyNullFields.join(',') || '—'}]`,
      { coverage: report.coverage },
    );
    if (report.fullyNullFields.length > 0) {
      logger.warn(
        `[product:${productId}] kit-components source=${source} — ${report.fullyNullFields.length} ` +
          `campo(s) 100% null: ${report.fullyNullFields.join(', ')}. ` +
          `Provável gap de ETL no SSOT (não de fetch).`,
      );
    }
  };

  const kitPromise: Promise<KitComponent[]> = product.is_kit
    ? fetchKitFromView()
        .then(async (rows) => {
          if (rows.length > 0) {
            auditKitFields('view', rows);
            return rows;
          }
          logger.info(
            `[product:${productId}] view v_kit_component_complete vazia — fallback para tabela base`,
          );
          const baseRows = await fetchKitFromBase();
          auditKitFields('base', baseRows);
          if (baseRows.length > 0) {
            logger.warn(
              `[product:${productId}] FALLBACK ATIVO: view retornou 0 linhas mas base retornou ${baseRows.length}. ` +
                `View pode estar com filtro RLS divergente ou JOIN excluindo linhas.`,
            );
          }
          return baseRows;
        })
        .catch(async (err) => {
          logger.warn(
            `[product:${productId}] view v_kit_component_complete falhou, fallback para tabela base:`,
            err,
          );
          try {
            const baseRows = await fetchKitFromBase();
            auditKitFields('base', baseRows);
            return baseRows;
          } catch (err2) {
            logger.warn(`[product:${productId}] Não foi possível buscar componentes do kit:`, err2);
            return [] as KitComponent[];
          }
        })
    : Promise.resolve([]);

  // NOTA DE NEGÓCIO: kits nativos do fornecedor são vendidos como conjunto único.
  // Componentes NÃO são SKUs vendáveis avulsos — portanto não buscamos preço/estoque por componente.
  const [allProductImages, enrichment, variants, videos, kitComponents] = await Promise.all([
    imagesPromise,
    enrichmentPromise,
    variantsPromise,
    videosPromise,
    kitPromise,
  ]);

  let imagesAll: ProductImage[] = allProductImages;
  if (allProductImages.length === IMAGES_PAGE) {
    try {
      const more = await dbInvoke<ProductImage>({
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
    // Tipos técnicos que NÃO devem aparecer na galeria do produto. (ADR-001)
    const colorImages = imagesAll
      .filter((img) => img.supplier_code && !TECHNICAL_IMAGE_TYPES.has(img.image_type))
      .sort((a, b) => a.display_order - b.display_order);
    const generalImages = imagesAll
      .filter((img) => !img.supplier_code && !TECHNICAL_IMAGE_TYPES.has(img.image_type))
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

  // ── Lookup color_variations.internal_code (XBZ, ASIA, SÓ MARCAS) ───────────
  // fix_version: pdp_sku_badge_v2
  // Fornecedores cujo product_variants.sku usa código próprio (não canônico):
  //   XBZ:      'ER143B-CIN'      → badge: 'ER143B-11.2'
  //   ASIA:     'ASIA-BAC006-AZ'  → badge: 'BAC006-1.1'
  //   SÓ MARCAS: 'AS-00610'      → badge: '{sku_promo}-{cv.internal_code}'
  // SPOT (51736-2.1) já usa o padrão canônico — não precisa lookup.
  const SUPPLIERS_NEEDING_CV_CODE = new Set([
    'd6718a29-e954-4c1b-bd84-03ea24884900', // XBZ
    'd2734e23-d633-4819-bb15-e51aa44e2118', // ASIA IMPORT
    '841cd690-210a-422a-908c-7676828db272', // SÓ MARCAS
  ]);
  const colorIdToInternalCode = new Map<string, string>();

  if (SUPPLIERS_NEEDING_CV_CODE.has(product.supplier_id ?? '') && variants.length > 0) {
    const uniqueColorIds = [...new Set(
      variants.map((v) => v.color_id).filter((id): id is string => !!id)
    )];
    if (uniqueColorIds.length > 0) {
      try {
        const cvResult = await dbInvoke<{ id: string; internal_code: string | null }>({
          table: 'color_variations',
          operation: 'select',
          select: 'id, internal_code',
          filters: { id: uniqueColorIds },
          limit: uniqueColorIds.length + 10,
        });
        for (const cv of cvResult.records) {
          if (cv.id && cv.internal_code) {
            colorIdToInternalCode.set(cv.id, cv.internal_code);
          }
        }
      } catch (err) {
        logger.warn(
          `[product:${productId}] Não foi possível buscar internal_code de color_variations:`,
          err,
        );
      }
    }
  }

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
        // fix_version: pdp_sku_badge_v2 — sku do badge:
        // XBZ: '{sku_promo}-{cv.internal_code}' (ex: ER143B-11.2 para Cinza)
        // SPOT/outros: variant.sku já tem o formato correto (ex: 51736-2.1)
        const cvInternalCode = variant.color_id
          ? colorIdToInternalCode.get(variant.color_id)
          : undefined;
        const skuPromo = (product as { sku_promo?: string | null }).sku_promo || product.sku;
        const entry: ColorEntry = {
          name: variant.color_name,
          hex: variant.color_hex || '#CCCCCC',
          code: variant.color_code || '',
          sku: cvInternalCode && skuPromo
            ? `${skuPromo}-${cvInternalCode}`
            : variant.sku || undefined,
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

    if (fallbackVariantIds.length > 0) {
      try {
        const fb = await dbInvoke<{
          id: string;
          images: string[] | null;
          selected_thumbnail: string | null;
        }>({
          table: 'product_variants',
          operation: 'select',
          select: 'id, images, selected_thumbnail',
          filters: { id: fallbackVariantIds },
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

  if (kitComponents.length > 0) {
    product.kit_components = kitComponents;
  }

  return product;
}

export async function fetchPromobrindProductBySku(sku: string): Promise<PromobrindProduct | null> {
  const selectFields = [
    PRODUCT_SELECT_FIELDS_WITH_SALE,
    PRODUCT_SELECT_FIELDS_WITH_SALE_NO_THRESHOLD,
    PRODUCT_SELECT_FIELDS_LEGACY,
    PRODUCT_SELECT_FIELDS_LEGACY_NO_THRESHOLD,
  ];
  let lastError: unknown;
  for (const select of selectFields) {
    try {
      const result = await dbInvoke<PromobrindProduct>({
        table: 'products',
        operation: 'select',
        filters: { sku },
        select,
        limit: 1,
      });
      return result.records[0] || null;
    } catch (err) {
      lastError = err;
      if (!shouldFallbackSelect(err)) throw err;
    }
  }
  throw lastError;
}

export async function fetchPromobrindCategories(): Promise<{ id: string; name: string }[]> {
  try {
    const result = await dbInvoke<{ id: string; name: string }>({
      table: 'categories',
      operation: 'select',
      select: 'id, name',
      limit: 500,
      orderBy: { column: 'name', ascending: true },
      countMode: 'none',
    });
    for (const c of result.records) {
      if (c?.id && c?.name) putInCacheSafe('categories', { id: c.id, name: c.name });
    }
    return result.records;
  } catch (err) {
    if (err instanceof Error && (err.message.includes('410') || err.message.includes('Gone'))) {
      logger.warn('[products-detail] Bridge deprecated (410) for categories');
      return [];
    }
    const result = await dbInvoke<{ category_id: string; main_category_id: string }>({
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
    const result = await dbInvoke<{
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
    if (err instanceof Error && (err.message.includes('410') || err.message.includes('Gone'))) {
      logger.warn('[products-detail] Bridge deprecated (410) for colors');
      return [];
    }
    logger.warn('Erro ao buscar cores das variantes:', err);
    return [];
  }
}

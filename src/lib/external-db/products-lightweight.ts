/**
 * Lightweight product fetch — minimal fields, no enrichment.
 * Used for selectors and catalog listing.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';
import { type InvokeResult } from './bridge';

const PRODUCT_SELECT_LIGHTWEIGHT =
  'id, name, sku, supplier_reference, sale_price, cost_price, primary_image_url, primary_image_fallback_url, set_image_url, supplier_id, category_id, main_category_id, brand, is_active, active, stock_quantity, min_quantity, is_kit, is_new, is_featured, is_bestseller, is_on_sale, allows_personalization, has_commercial_packaging, created_at, gender, short_description, ai_title, ai_description, ai_summary, ai_version, ai_generated_at, ' +
  // 2026-06-22: Color Swatches V2 — pré-computados por fn_rebuild_color_swatches (P1→P4).
  // 7.153 produtos / 16.631 swatches / 97,4% CF CDN. Consumido por ColorSwatchPicker.
  // v_products_public atualizada para expor estes campos (migration 20260622).
  'color_swatches, has_colors';
const LIGHTWEIGHT_PAGE_SIZE = 500;
const LIGHTWEIGHT_MAX_CONCURRENCY = 3;
const LIGHTWEIGHT_MIN_SPLIT_PAGE_SIZE = 125;
const LIGHTWEIGHT_MAX_TOTAL = 15000;
const LIGHTWEIGHT_INITIAL_BURST = 4;

export interface LightweightProduct {
  id: string;
  name: string;
  sku: string;
  supplier_reference?: string | null;
  sale_price?: number | null;
  cost_price?: number | null;
  image_url: string | null;
  primary_image_url: string | null;
  primary_image_fallback_url?: string | null;
  /**
   * URL da imagem "set" (todas as cores juntas) no Cloudflare Images.
   * Sem sufixo de variante — concatenar /public para exibição.
   * null = produto não tem imagem set (hover não acontece no card).
   * Adicionado em 2026-06-02: SPOT original + XBZ d1 reclassificado.
   */
  set_image_url: string | null;
  supplier_id: string | null;
  category_id: string | null;
  main_category_id: string | null;
  /** Leaf category (mais profunda) — preenchido por mv_product_leaf_category na view v_products_public. */
  // FIX BUG-D (2026-06-18): campos pré-computados em v_products_public via mv_product_leaf_category.
  leaf_category_id?: string | null;
  leaf_category_name?: string | null;
  leaf_category_level?: number | null;
  brand: string | null;
  is_active: boolean;
  active: boolean;
  stock_quantity?: number | null;
  min_quantity?: number | null;
  is_kit?: boolean | null;
  is_new?: boolean | null;
  // Quick-option flags exibidos no Super Filtro. Antes ausentes do SELECT/tipo,
  // tornavam os toggles "Destaques", "Promoções", "Com Personalização" e
  // "Com Embalagem Nativa" inertes (sempre 0 resultados). Mapeados em
  // mapLightweightToProduct espelhando product-mapper.ts.
  is_featured?: boolean | null;
  is_bestseller?: boolean | null;
  is_on_sale?: boolean | null;
  allows_personalization?: boolean | null;
  has_commercial_packaging?: boolean | null;
  created_at?: string | null;
  gender?: string | null;
  short_description?: string | null;
  price_updated_at?: string | null;
  price_freshness_threshold_days?: number | null;
  // Word Magic — campos gerados por IA (adicionados para suporte ao toggle global)
  ai_title?: string | null;
  ai_description?: string | null;
  ai_summary?: string | null;
  ai_version?: number | null;
  ai_generated_at?: string | null;
  /**
   * Color Swatches V2 (2026-06-22) — JSONB pré-computado por fn_rebuild_color_swatches.
   * Hierarquia de imagem P1(CF CDN/variant_id)→P2(CF CDN/color_id)→P3(supplier)→P4(primary).
   * stock_quantity = SUM por color_id (correto para produtos multi-tamanho).
   * Consumido por useProductColorSwatch + ColorSwatchPicker quando useColorSwatchesV2=true.
   */
  color_swatches?: unknown[] | null;
  has_colors?: boolean | null;
}

function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /(statement timeout|canceling statement|57014|bad gateway|boot_error|function failed to start)/i.test(
    message,
  );
}

async function fetchPage(params: {
  filters: Record<string, unknown>;
  orderBy: { column: string; ascending?: boolean };
  limit: number;
  offset: number;
  countMode?: 'estimated' | 'exact' | 'none' | 'planned';
}): Promise<InvokeResult<LightweightProduct>> {
  try {
    return await dbInvoke<LightweightProduct>({
      table: 'products',
      operation: 'select',
      filters: params.filters,
      select: PRODUCT_SELECT_LIGHTWEIGHT,
      orderBy: params.orderBy,
      limit: params.limit,
      offset: params.offset,
      countMode: params.countMode ?? 'none',
    });
  } catch (err) {
    if (err instanceof Error && (err.message.includes('410') || err.message.includes('Gone'))) {
      logger.warn('[lightweight] Bridge deprecated (410) for products');
      return { records: [], count: 0 };
    }
    throw err;
  }
}

async function fetchPageResilient(params: {
  filters: Record<string, unknown>;
  orderBy: { column: string; ascending?: boolean };
  limit: number;
  offset: number;
  countMode?: 'estimated' | 'exact' | 'none' | 'planned';
}): Promise<InvokeResult<LightweightProduct>> {
  try {
    return await fetchPage(params);
  } catch (error) {
    if (!isTimeoutError(error) || params.limit <= LIGHTWEIGHT_MIN_SPLIT_PAGE_SIZE) throw error;
    const firstHalf = Math.ceil(params.limit / 2);
    const secondHalf = params.limit - firstHalf;
    logger.warn(
      `[lightweight] Timeout at offset=${params.offset}, splitting ${params.limit} -> ${firstHalf}+${secondHalf}`,
    );
    const [left, right] = await Promise.all([
      fetchPageResilient({ ...params, limit: firstHalf, countMode: 'none' }),
      fetchPageResilient({
        ...params,
        offset: params.offset + firstHalf,
        limit: secondHalf,
        countMode: 'none',
      }),
    ]);
    return {
      records: [...left.records, ...right.records],
      count: params.countMode === 'none' ? null : (left.count ?? right.count ?? null),
    };
  }
}

export async function fetchPromobrindProductsLightweight(options?: {
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, unknown>;
}): Promise<LightweightProduct[]> {
  const filters: Record<string, unknown> = { ...options?.filters };
  if (options?.search) filters._search = options.search;
  const orderBy = options?.orderBy ?? { column: 'name', ascending: true };
  const baseOffset = options?.offset ?? 0;

  if (typeof options?.limit === 'number' && options.limit > 0) {
    const result = await fetchPageResilient({
      filters,
      orderBy,
      limit: options.limit,
      offset: baseOffset,
      countMode: 'none',
    });
    return result.records;
  }

  const maxTotal = LIGHTWEIGHT_MAX_TOTAL;

  const initialBatch = Array.from({ length: LIGHTWEIGHT_INITIAL_BURST }, (_, i) => ({
    table: 'products',
    operation: 'select' as const,
    select: PRODUCT_SELECT_LIGHTWEIGHT,
    filters,
    orderBy,
    limit: LIGHTWEIGHT_PAGE_SIZE,
    offset: baseOffset + i * LIGHTWEIGHT_PAGE_SIZE,
  }));

  const products: LightweightProduct[] = [];
  let lastBurstPageSize = LIGHTWEIGHT_PAGE_SIZE;

  try {
    const batchResults = await Promise.all(initialBatch.map((q) => dbInvoke<unknown>(q)));
    for (const result of batchResults) {
      if (result.records) {
        const records = result.records as LightweightProduct[];
        products.push(...records);
        lastBurstPageSize = records.length;
      }
    }
  } catch (batchError) {
    logger.warn('[lightweight] Burst inicial falhou, fallback sequencial:', batchError);
    return fetchSequential(filters, orderBy, baseOffset, maxTotal);
  }

  if (lastBurstPageSize < LIGHTWEIGHT_PAGE_SIZE) return products;
  if (products.length >= maxTotal) return products.slice(0, maxTotal);

  let nextOffset = baseOffset + LIGHTWEIGHT_INITIAL_BURST * LIGHTWEIGHT_PAGE_SIZE;
  while (products.length < maxTotal) {
    let page: InvokeResult<LightweightProduct>;
    try {
      page = await fetchPageResilient({
        filters,
        orderBy,
        limit: LIGHTWEIGHT_PAGE_SIZE,
        offset: nextOffset,
        countMode: 'none',
      });
    } catch (err) {
      logger.warn(
        `[lightweight] Fase 2 abortada em offset=${nextOffset} (${products.length} produtos):`,
        err,
      );
      break;
    }
    if (page.records.length === 0) break;
    products.push(...page.records);
    if (page.records.length < LIGHTWEIGHT_PAGE_SIZE) break;
    nextOffset += LIGHTWEIGHT_PAGE_SIZE;
  }

  return products.slice(0, maxTotal);
}

async function fetchSequential(
  filters: Record<string, unknown>,
  orderBy: { column: string; ascending?: boolean },
  baseOffset: number,
  maxTotal: number,
): Promise<LightweightProduct[]> {
  const firstPage = await fetchPageResilient({
    filters,
    orderBy,
    limit: LIGHTWEIGHT_PAGE_SIZE,
    offset: baseOffset,
    countMode: 'planned',
  });
  const products: LightweightProduct[] = [...firstPage.records];
  if (firstPage.records.length < LIGHTWEIGHT_PAGE_SIZE) return products;

  const estimatedTotal =
    typeof firstPage.count === 'number' && firstPage.count > firstPage.records.length
      ? Math.min(firstPage.count, maxTotal)
      : maxTotal;
  const remaining = estimatedTotal - products.length;
  if (remaining <= 0) return products;

  const offsets = Array.from(
    { length: Math.ceil(remaining / LIGHTWEIGHT_PAGE_SIZE) },
    (_, i) => baseOffset + LIGHTWEIGHT_PAGE_SIZE * (i + 1),
  );

  for (let i = 0; i < offsets.length; i += LIGHTWEIGHT_MAX_CONCURRENCY) {
    const batch = offsets.slice(i, i + LIGHTWEIGHT_MAX_CONCURRENCY);
    const pages = await Promise.all(
      batch.map((offset) =>
        fetchPageResilient({
          filters,
          orderBy,
          limit: LIGHTWEIGHT_PAGE_SIZE,
          offset,
          countMode: 'none',
        }),
      ),
    );
    for (const page of pages) products.push(...page.records);
    if (pages[pages.length - 1]?.records.length < LIGHTWEIGHT_PAGE_SIZE) break;
    if (products.length >= maxTotal) break;
  }
  return products;
}

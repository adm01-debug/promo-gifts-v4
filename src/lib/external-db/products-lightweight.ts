/**
 * Lightweight product fetch — minimal fields, no enrichment.
 * Used for selectors and catalog listing.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';
import type { InvokeResult } from './bridge';

const PRODUCT_SELECT_LIGHTWEIGHT =
  'id, name, sku, supplier_reference, sale_price, cost_price, primary_image_url, primary_image_fallback_url, set_image_url, supplier_id, category_id, main_category_id, brand, is_active, active, stock_quantity, min_quantity, is_kit, is_new, created_at, gender, short_description, ai_title, ai_description, ai_summary, ai_version, ai_generated_at';
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
  brand: string | null;
  is_active: boolean;
  active: boolean;
  stock_quantity?: number | null;
  min_quantity?: number | null;
  is_kit?: boolean | null;
  is_new?: boolean | null;
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
  countMode?: 'exact' | 'planned' | 'estimated' | 'none';
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
  countMode?: 'exact' | 'planned' | 'estimated' | 'none';
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
    if ((pages.at(-1)?.records.length ?? 0) < LIGHTWEIGHT_PAGE_SIZE) break;
    if (products.length >= maxTotal) break;
  }
  return products;
}

/**
 * useProductsLightweight — Minimal product data for selectors & catalog
 *
 * Loads ~10x faster than useProducts (no color/variant enrichment).
 */
import { dbInvoke, shouldRetry } from '@/lib/db/postgrest';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
  fetchPromobrindProductsLightweight,
  type LightweightProduct,
} from '@/lib/external-db/products-lightweight';
import { fetchPromobrindCategories } from '@/lib/external-db/products-detail';

// Re-export type for consumers
export type { ProductLightweight } from '@/types/product-catalog';
import type { ProductLightweight, Product } from '@/types/product-catalog';

const NOVELTY_WINDOW_DAYS = 30;

function isWithinNoveltyWindow(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return false;
  const elapsedDays = (Date.now() - ts) / 86400000;
  return elapsedDays >= 0 && elapsedDays <= NOVELTY_WINDOW_DAYS;
}

function mapLightweight(p: LightweightProduct): ProductLightweight {
  const price = p.sale_price ?? p.cost_price ?? 0;
  const imageUrl = p.primary_image_url || p.image_url || '/placeholder.svg';
  return {
    id: String(p.id),
    name: p.name,
    sku: p.sku,
    supplier_reference: p.supplier_reference ?? null,
    price: typeof price === 'number' ? price : 0,
    image_url: imageUrl,
    stock: p.stock_quantity ?? 0,
    brand: p.brand,
    category_id: p.category_id || p.main_category_id,
    is_active: p.is_active || p.active,
  };
}

function getStockStatus(stock: number): 'in-stock' | 'low-stock' | 'out-of-stock' {
  if (stock <= 0) return 'out-of-stock';
  if (stock < 10) return 'low-stock';
  return 'in-stock';
}

export function mapLightweightToProduct(
  p: LightweightProduct,
  categoriesById?: ReadonlyMap<string, string>,
): Product {
  const imageUrl = p.primary_image_url || p.image_url || '/placeholder.svg';
  const price = p.sale_price ?? p.cost_price ?? 0;
  const stock = p.stock_quantity || 0;
  const resolvedCategoryId = p.category_id || p.main_category_id;
  const resolvedCategoryName = resolvedCategoryId
    ? (categoriesById?.get(resolvedCategoryId) ?? null)
    : null;

  // set_image_url: URL da imagem "set" (todas as cores juntas).
  // null = produto não tem set → card mostra imagem estática sem hover.
  // Fontes: SPOT (original) + XBZ d1 reclassificado (2026-06-02).
  const setImageUrl = p.set_image_url ?? null;

  return {
    id: String(p.id),
    name: p.name,
    description: p.short_description || '',
    shortDescription: p.short_description ?? '',
    category_id: resolvedCategoryId,
    category_name: resolvedCategoryName,
    price: typeof price === 'number' ? price : 0,
    image_url: imageUrl,
    set_image_url: setImageUrl,
    images: [imageUrl],
    sku: p.sku,
    stock,
    created_at: p.created_at ?? undefined,
    colors: [],
    materials: [],
    supplier_reference: p.supplier_reference ?? null,
    brand: p.brand,
    is_active: p.is_active || p.active,
    minQuantity: p.min_quantity || 1,
    stockStatus: getStockStatus(stock),
    // Espelha product-mapper.ts: featured = is_featured OR is_bestseller.
    // Antes hardcoded false → toggle "Destaques" do Super Filtro retornava 0.
    featured: Boolean(p.is_featured || p.is_bestseller),
    newArrival: Boolean(p.is_new) || isWithinNoveltyWindow(p.created_at),
    onSale: Boolean(p.is_on_sale),
    hasPersonalization: Boolean(p.allows_personalization),
    hasCommercialPackaging: Boolean(p.has_commercial_packaging),
    isKit: p.is_kit ?? false,
    gender: p.gender || null,
    category: { id: resolvedCategoryId || '0', name: resolvedCategoryName ?? 'Sem categoria' },
    supplier: { id: p.supplier_id || p.brand || 'unknown', name: p.brand || 'Fornecedor' },
    tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
    dimensions: {},
    priceUpdatedAt: p.price_updated_at ?? null,
    priceFreshnessThresholdDays: null,
    // Word Magic — campos AI para o toggle global (aiTitle/aiDescription/aiVersion)
    aiTitle: p.ai_title ?? null,
    aiDescription: p.ai_description ?? null,
    aiSummary: p.ai_summary ?? null,
    aiVersion: typeof p.ai_version === 'number' ? p.ai_version : null,
    aiGeneratedAt: p.ai_generated_at ?? null,
  };
}

export const CATALOG_PAGE_SIZE = 500;
export const CATALOG_BATCH_PAGES = 4;

/**
 * SELECT do catálogo.
 *
 * ALTERAÇÃO (2026-06-02): adicionado set_image_url para suporte ao efeito de
 * hover na imagem do card (mostra foto com todas as cores ao passar o mouse).
 * Custo: +1 campo text por linha — impacto negligenciável (~8 bytes/produto).
 */
export const PRODUCT_SELECT_LIGHTWEIGHT =
  'id, name, sku, supplier_reference, short_description, ' +
  'sale_price, cost_price, primary_image_url, set_image_url, ' +
  'supplier_id, category_id, main_category_id, brand, is_active, active, ' +
  'stock_quantity, min_quantity, is_kit, is_new, ' +
  'is_featured, is_bestseller, is_on_sale, allows_personalization, has_commercial_packaging, ' +
  'created_at, gender, price_updated_at, ' +
  'ai_title, ai_description, ai_summary, ai_version, ai_generated_at';
// FIX 2026-06-14 (catalog-search-audit): incluídos supplier_reference e short_description.
// Antes ausentes no SELECT -> mapLightweightToProduct gravava supplier_reference=null e
// description='' em TODO produto da grade, neutralizando o re-rank/substring client-side por
// referência do fornecedor e descrição. Mantidos is_new/created_at (feature newArrival).

interface CatalogPage {
  products: Product[];
  nextOffset: number | null;
  totalEstimate: number | null;
}

async function loadCategoriesMap(): Promise<ReadonlyMap<string, string>> {
  try {
    const categories = await fetchPromobrindCategories();
    return new Map(categories.map((c) => [String(c.id), c.name]));
  } catch {
    return new Map();
  }
}

/**
 * FIX 2026-06-18 (catalog-audit): ordenação server-side para os sorts
 * best-seller-* via RPC get_catalog_bestseller_page. Sem isto, o servidor
 * paginava por `name` e o cliente reordenava SÓ a janela já carregada
 * (~2000 de ~7150) — campeões de venda alfabeticamente tardios nunca
 * alcançavam o topo. A RPC ordena o conjunto GLOBAL de ativos (turnover ou
 * vendas promo) e devolve as próprias linhas de v_products_public (mesmas
 * colunas/grants), sem precisar de um segundo fetch por id (evita URL gigante).
 * Usada apenas no caminho SEM busca/filtros; com filtros o ranking permanece
 * client-side sobre o conjunto (menor) filtrado.
 */
async function fetchBestSellerCatalogPage(
  offset: number,
  sortBy: string,
): Promise<CatalogPage> {
  const isFirstLoad = offset === 0;
  const pagesToFetch = isFirstLoad ? CATALOG_BATCH_PAGES : 1;
  const span = CATALOG_PAGE_SIZE * pagesToFetch;

  // RPC fora dos tipos gerados -> cast `as never` (padrão do projeto).
  const { data, error } = await supabase.rpc('get_catalog_bestseller_page' as never, {
    p_sort: sortBy,
    p_limit: span,
    p_offset: offset,
  } as never);
  if (error) throw error;

  const rows = (data as unknown as LightweightProduct[] | null) ?? [];
  const categoriesById = await loadCategoriesMap();
  const products = rows.map((r) => mapLightweightToProduct(r, categoriesById));

  // Total exato apenas no primeiro load (o front mantém o número estável depois).
  let totalEstimate: number | null = null;
  if (isFirstLoad) {
    const { count } = await dbInvoke<LightweightProduct>({
      table: 'products',
      operation: 'select',
      select: 'id',
      filters: { active: true },
      limit: 1,
      offset: 0,
      countMode: 'exact',
    });
    totalEstimate = count;
  }

  const nextOffset = rows.length === span ? offset + rows.length : null;
  return { products, nextOffset, totalEstimate };
}

async function fetchCatalogPage(
  offset: number,
  search?: string,
  categories?: string[],
  suppliers?: string[],
  sortBy?: string,
): Promise<CatalogPage> {
  // best-seller-*: ordenação server-side (RPC) no caminho sem busca/filtros.
  // Fallback gracioso: qualquer erro cai no fluxo padrão (name + re-sort client-side).
  const isBestSeller = sortBy === 'best-seller-supplier' || sortBy === 'best-seller-promo';
  const hasNoConstraints =
    !search &&
    (!categories || categories.length === 0) &&
    (!suppliers || suppliers.length === 0);
  if (isBestSeller && hasNoConstraints) {
    try {
      return await fetchBestSellerCatalogPage(offset, sortBy as string);
    } catch (err) {
      logger.warn('[catalog] RPC best-seller indisponível; fallback p/ ordenação client-side', err);
    }
  }

  const filters: Record<string, unknown> = { active: true };
  if (search) filters._search = search;
  if (categories && categories.length > 0) filters.category_id = categories;
  if (suppliers && suppliers.length > 0) filters.supplier_id = suppliers;

  let orderBy: { column: string; ascending?: boolean; nullsFirst?: boolean } = {
    column: 'name',
    ascending: true,
  };

  if (sortBy) {
    switch (sortBy) {
      case 'price-asc':
        // NULLS LAST: produtos sem preço não devem liderar a ordenação por preço.
        orderBy = { column: 'sale_price', ascending: true, nullsFirst: false };
        break;
      case 'price-desc':
        orderBy = { column: 'sale_price', ascending: false, nullsFirst: false };
        break;
      case 'newest':
        orderBy = { column: 'created_at', ascending: false };
        break;
      case 'stock':
        orderBy = { column: 'stock_quantity', ascending: false };
        break;
      default:
        orderBy = { column: 'name', ascending: true };
        break;
    }
  }

  // BUG-PAGE-01 FIX: desempate determinístico por id em TODAS as ordenações.
  // Sem ele, colunas não-únicas (created_at com até 591 empates, sale_price, stock
  // com 1353 zerados, name com 891 nomes repetidos) + paginação OFFSET produzem
  // ordem instável entre páginas → o mesmo produto pode DUPLICAR ou SUMIR no scroll.
  const secondaryOrderBy = { column: 'id', ascending: true } as const;

  const isFirstLoad = offset === 0;
  const pagesToFetch = isFirstLoad ? CATALOG_BATCH_PAGES : 1;

  const batchQueries = Array.from({ length: pagesToFetch }, (_, i) => ({
    table: 'products',
    operation: 'select' as const,
    select: PRODUCT_SELECT_LIGHTWEIGHT,
    filters,
    orderBy,
    secondaryOrderBy,
    limit: CATALOG_PAGE_SIZE,
    offset: offset + i * CATALOG_PAGE_SIZE,
    ...(i === 0 && isFirstLoad ? { countMode: 'exact' as const } : {}),
  }));

  const categoriesPromise = loadCategoriesMap();

  let batchResults;
  try {
    batchResults = await Promise.all(batchQueries.map((q) => dbInvoke(q)));
  } catch {
    const restQueries = Array.from({ length: pagesToFetch }, (_, i) =>
      dbInvoke<LightweightProduct>({
        table: 'products',
        operation: 'select',
        select: PRODUCT_SELECT_LIGHTWEIGHT,
        filters,
        orderBy,
        secondaryOrderBy,
        limit: CATALOG_PAGE_SIZE,
        offset: offset + i * CATALOG_PAGE_SIZE,
        ...(i === 0 && isFirstLoad ? { countMode: 'exact' as const } : {}),
      }).catch(() => ({ records: [] as LightweightProduct[], count: null as number | null })),
    );
    const [pageResults, categoriesById] = await Promise.all([
      Promise.all(restQueries),
      categoriesPromise,
    ]);
    const fallbackProducts: Product[] = [];
    let fallbackTotalEstimate: number | null = null;
    let fallbackLastPageSize = 0;
    for (const result of pageResults) {
      fallbackProducts.push(
        ...result.records.map((p) => mapLightweightToProduct(p, categoriesById)),
      );
      fallbackLastPageSize = result.records.length;
      if (result.count !== null && fallbackTotalEstimate === null)
        fallbackTotalEstimate = result.count;
    }
    const fallbackFetchedUpTo = offset + pagesToFetch * CATALOG_PAGE_SIZE;
    return {
      products: fallbackProducts,
      nextOffset: fallbackLastPageSize === CATALOG_PAGE_SIZE ? fallbackFetchedUpTo : null,
      totalEstimate: fallbackTotalEstimate,
    };
  }

  const categoriesById = await categoriesPromise;
  const products: Product[] = [];
  let totalEstimate: number | null = null;
  let lastPageSize = 0;

  for (const result of batchResults) {
    if (result.records && result.records.length > 0) {
      const mapped = (result.records as LightweightProduct[]).map((p) =>
        mapLightweightToProduct(p, categoriesById),
      );
      products.push(...mapped);
      lastPageSize = result.records.length;
      if (result.count !== null && totalEstimate === null) {
        totalEstimate = result.count as number;
      }
    } else if (result.records) {
      lastPageSize = 0;
    }
  }

  const fetchedUpTo = offset + products.length;
  return {
    products,
    nextOffset: lastPageSize === CATALOG_PAGE_SIZE ? fetchedUpTo : null,
    totalEstimate,
  };
}

export function useProductsLightweight() {
  return useQuery<ProductLightweight[]>({
    queryKey: ['promobrind-products-lightweight', 'v3-page-100'],
    queryFn: async () => {
      const products = await fetchPromobrindProductsLightweight();
      return products.map(mapLightweight);
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 120 * 60 * 1000,
    refetchOnWindowFocus: false,
    // FIX 2026-06-02: shouldRetry para em 4xx (status < 500) imediatamente.
    // O retry:3 anterior fazia 3 tentativas mesmo em 400 Bad Request,
    // multiplicando chamadas falhas ao DB. shouldRetry usa .status do
    // PostgrestError (mais confiável que regex no message).
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useProductsCatalog(filters?: {
  search?: string;
  categories?: string[];
  suppliers?: string[];
  sortBy?: string;
}) {
  const search = filters?.search || '';
  const categories = filters?.categories ?? [];
  const suppliers = filters?.suppliers ?? [];
  const sortBy = filters?.sortBy || 'newest';
  return useInfiniteQuery<CatalogPage, Error>({
    queryKey: ['promobrind-products-catalog', search, categories, suppliers, sortBy],
    queryFn: ({ pageParam }) =>
      fetchCatalogPage(pageParam as number, search || undefined, categories, suppliers, sortBy),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 30 * 60 * 1000,
    gcTime: 120 * 60 * 1000,
    refetchOnWindowFocus: false,
    // FIX 2026-06-02: idem acima – shouldRetry para em 4xx imediatamente.
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

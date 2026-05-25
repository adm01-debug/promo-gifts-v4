/**
 * useProductsLightweight — Minimal product data for selectors & catalog
 *
 * Loads ~10x faster than useProducts (no color/variant enrichment).
 */
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { invokeBatchBridge } from '@/lib/external-db/bridge';
import {
  fetchPromobrindProductsLightweight,
  type LightweightProduct,
} from '@/lib/external-db/products-lightweight';
import { fetchPromobrindCategories } from '@/lib/external-db/products-detail';

// Re-export type for consumers
export type { ProductLightweight } from '@/types/product-catalog';
import type { ProductLightweight, Product } from '@/types/product-catalog';

function mapLightweight(p: LightweightProduct): ProductLightweight {
  const price = p.sale_price ?? p.cost_price ?? 0;
  const imageUrl = p.primary_image_url || p.image_url || '/placeholder.svg';

  return {
    id: p.id,
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

  return {
    id: p.id,
    name: p.name,
    description: '',
    category_id: resolvedCategoryId,
    category_name: resolvedCategoryName,
    price: typeof price === 'number' ? price : 0,
    image_url: imageUrl,
    images: [imageUrl],
    sku: p.sku,
    stock,
    colors: [],
    materials: [],
    supplier_reference: p.supplier_reference ?? null,
    brand: p.brand,
    is_active: p.is_active || p.active,
    minQuantity: p.min_quantity || 1,
    stockStatus: getStockStatus(stock),
    featured: false,
    newArrival: false,
    onSale: false,
    isKit: p.is_kit ?? false,
    gender: p.gender || null,
    category: {
      id: resolvedCategoryId || '0',
      name: resolvedCategoryName ?? 'Sem categoria',
    },
    supplier: {
      id: p.supplier_id || p.brand || 'unknown',
      name: p.brand || 'Fornecedor',
    },
    tags: {
      publicoAlvo: [],
      datasComemorativas: [],
      endomarketing: [],
      ramo: [],
      nicho: [],
    },
    dimensions: {},
    // SSOT externo. `price_freshness_threshold_days` ainda não vem na lightweight
    // (coluna inexistente no BD externo) — fica null e o util cai no default 60d
    // ou no override local resolvido pelo consumidor.
    priceUpdatedAt: p.price_updated_at ?? null,
    priceFreshnessThresholdDays: null,
  };
}

// ============================================
// INFINITE CATALOG HOOK
// ============================================

export const CATALOG_PAGE_SIZE = 500;
export const CATALOG_BATCH_PAGES = 4;
// `price_updated_at` é o SSOT da idade do preço (trigger no BD externo).
// `price_freshness_threshold_days` ainda NÃO existe no BD externo — quando
// existir, basta acrescentar à lista; o mapper já trata como opcional.
export const PRODUCT_SELECT_LIGHTWEIGHT =
  'id, name, sku, sale_price, cost_price, primary_image_url, supplier_id, category_id, main_category_id, brand, is_active, active, stock_quantity, min_quantity, is_kit, gender, price_updated_at';

interface CatalogPage {
  products: Product[];
  nextOffset: number | null; // null = no more pages
  totalEstimate: number | null;
}

/**
 * Fetches a batch of catalog pages starting at the given offset.
 * First call fetches 4 pages (2000 products) via batch bridge.
 * Subsequent calls fetch 1 page (500 products) each.
 */
async function loadCategoriesMap(): Promise<ReadonlyMap<string, string>> {
  try {
    const categories = await fetchPromobrindCategories();
    return new Map(categories.map((c) => [String(c.id), c.name]));
  } catch {
    return new Map();
  }
}

async function fetchCatalogPage(offset: number, search?: string): Promise<CatalogPage> {
  const filters: Record<string, unknown> = { active: true };
  if (search) filters._search = search;
  const orderBy = { column: 'name', ascending: true };

  const isFirstLoad = offset === 0;
  const pagesToFetch = isFirstLoad ? CATALOG_BATCH_PAGES : 1;

  const batchQueries = Array.from({ length: pagesToFetch }, (_, i) => ({
    table: 'products',
    operation: 'select' as const,
    select: PRODUCT_SELECT_LIGHTWEIGHT,
    filters,
    orderBy,
    limit: CATALOG_PAGE_SIZE,
    offset: offset + i * CATALOG_PAGE_SIZE,
    ...(i === 0 && isFirstLoad ? { countMode: 'exact' } : {}),
  }));

  const categoriesPromise = loadCategoriesMap();

  let batchResults;
  try {
    batchResults = await invokeBatchBridge(batchQueries);
  } catch {
    const [fallbackProducts, categoriesById] = await Promise.all([
      fetchPromobrindProductsLightweight({
        search,
        limit: CATALOG_PAGE_SIZE,
        offset,
        orderBy,
        filters: { active: true },
      }),
      categoriesPromise,
    ]);

    return {
      products: fallbackProducts.map((p) => mapLightweightToProduct(p, categoriesById)),
      nextOffset: fallbackProducts.length === CATALOG_PAGE_SIZE ? offset + CATALOG_PAGE_SIZE : null,
      totalEstimate: null,
    };
  }

  const categoriesById = await categoriesPromise;
  const products: Product[] = [];
  let totalEstimate: number | null = null;
  let lastPageSize = 0;

  for (const result of batchResults) {
    if (result.success && result.data?.records) {
      const mapped = (result.data.records as LightweightProduct[]).map((p) =>
        mapLightweightToProduct(p, categoriesById),
      );
      products.push(...mapped);
      lastPageSize = result.data.records.length;
      if (result.data.count !== null && totalEstimate === null) {
        totalEstimate = result.data.count as number;
      }
    }
  }

  const fetchedUpTo = offset + pagesToFetch * CATALOG_PAGE_SIZE;
  const hasMore = lastPageSize === CATALOG_PAGE_SIZE;

  return {
    products,
    nextOffset: hasMore ? fetchedUpTo : null,
    totalEstimate,
  };
}

/**
 * Hook leve para buscar lista de produtos com campos mínimos.
 */
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
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook com paginação infinita server-side para o catálogo.
 * Primeiro carregamento: 200 produtos (2 páginas batch).
 * Carregamentos seguintes: 100 produtos por vez, sob demanda.
 */
export function useProductsCatalog(filters?: { search?: string }) {
  const search = filters?.search || '';

  return useInfiniteQuery<CatalogPage, Error>({
    queryKey: ['promobrind-products-catalog', search],
    queryFn: ({ pageParam }) => fetchCatalogPage(pageParam as number, search || undefined),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 30 * 60 * 1000,
    gcTime: 120 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

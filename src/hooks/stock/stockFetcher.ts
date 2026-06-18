/**
 * stockFetcher — Busca paginada e processamento de dados de estoque
 */
import { untypedFrom } from '@/lib/supabase-untyped';
import { GOLD_READ_ALIASES } from '@/integrations/supabase/gold-relations';
import { logger } from '@/lib/logger';
import {
  type VariantStock,
  type ProductStockSummary,
  type StockAlert,
  type FutureStockEntry,
  calculateStockStatus,
  calculateDaysUntilStockout,
  calculateAvailableStock,
  aggregateVariantsToProduct,
} from '@/types/stock';
import { generateStockAlerts } from '@/hooks/stock/stockAlerts';

// ============================================
// TIPOS PARA API EXTERNA
// ============================================

interface ExternalProductWithVariants {
  id: string;
  name: string;
  sku?: string;
  min_quantity?: number;
  stock_quantity?: number;
  updated_at?: string;
  category_id?: string;
  supplier_id?: string;
  brand?: string;
}

interface ExternalVariantStock {
  id: string;
  product_id: string;
  sku?: string;
  name?: string;
  color_id?: string;
  color_name?: string;
  color_hex?: string;
  color_code?: string;
  stock_quantity: number;
  is_active?: boolean;
  updated_at?: string;
}

interface ExternalSupplierSource {
  id: string;
  variant_id: string;
  supplier_id?: string;
  supplier_sku?: string;
  quantity: number;
  // NOTA: a camada Ouro (variant_supplier_sources) NÃO possui coluna
  // reserved_quantity. Reservas não são rastreadas aqui; availableStock == current.
  next_quantity_1?: number | null;
  next_date_1?: string | null;
  next_quantity_2?: number | null;
  next_date_2?: string | null;
  next_quantity_3?: number | null;
  next_date_3?: string | null;
  next_quantity_4?: number | null;
  next_date_4?: string | null;
  next_quantity_5?: number | null;
  next_date_5?: string | null;
  next_quantity_6?: number | null;
  next_date_6?: string | null;
  is_active?: boolean;
  updated_at?: string;
}

export function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ============================================
// BUSCA PAGINADA
// ============================================

export async function fetchPaginatedFromBridge<T extends { id: string }>(
  table: string,
  select: string,
  pageSize = 1000,
  maxRecords = 100000,
  filters?: Record<string, unknown>,
): Promise<T[]> {
  // PostgREST nativo (Caminho B). A `external-db-bridge` foi descontinuada (410 Gone).
  //
  // BUG-STOCK-04 FIX — Paginação por KEYSET (cursor em `id`), não offset/range.
  // Raiz da contagem de variações inflada no dashboard (ex.: 22.620 vs ~18.4k):
  // o PostgREST NÃO garante ordem estável entre requisições HTTP separadas.
  // Com `.range()` e sem `.order()`, durante uma janela de escrita (sync de
  // fornecedor XBZ/SPOT em product_variants) as páginas se sobrepõem → linhas
  // duplicadas/saltadas → totais errados. Keyset (`order(id)` + `id > lastId`)
  // é imune a reordenação de linhas existentes e a inserts concorrentes; o
  // Set `seen` é cinto-e-suspensório contra qualquer duplicata residual.
  const all: T[] = [];
  const seen = new Set<string>();
  let lastId: string | null = null;
  let totalCount: number | null = null;

  // Aliases centralizados: tabelas Ouro expostas via views públicas (Medallion).
  const resolvedTable = (GOLD_READ_ALIASES as Record<string, string>)[table] ?? table;

  while (all.length < maxRecords) {
    let query = untypedFrom<Record<string, unknown>>(resolvedTable).select(
      select,
      lastId === null ? { count: 'exact' } : undefined,
    );

    if (filters) {
      for (const [col, val] of Object.entries(filters)) {
        if (val === null) query = query.is(col, null);
        else if (Array.isArray(val)) query = query.in(col, val);
        else query = query.eq(col, val);
      }
    }

    // Cursor estável: ordena por id e busca a próxima página após o último id visto.
    query = query.order('id', { ascending: true }).limit(pageSize);
    if (lastId !== null) query = query.gt('id', lastId);

    const { data, error, count } = await query;
    if (error) {
      if (error.message?.includes('410') || error.message?.includes('Gone')) {
        const { reportSilentEmpty } = await import('@/lib/external-db/silent-empty-report');
        reportSilentEmpty({
          reason: 'gone_410',
          table: resolvedTable,
          operation: 'select',
          message: error.message,
        });
        logger.warn(`[Stock] Bridge deprecated (410) for ${table} — stopping pagination.`);
        break;
      }
      const errorMsg = `Erro ao buscar ${table}: ${error.message}`;
      logger.error(`[Stock] ${errorMsg}`, error);
      throw new Error(errorMsg);
    }

    const records = (data ?? []) as unknown as T[];
    if (lastId === null && typeof count === 'number') totalCount = count;
    if (records.length === 0) break;

    for (const r of records) {
      const rid = r?.id;
      if (rid && !seen.has(rid)) {
        seen.add(rid);
        all.push(r);
      }
    }

    const nextCursor = records[records.length - 1]?.id ?? null;
    // Segurança: se o cursor não avançou, paramos para não loopar.
    if (nextCursor === null || nextCursor === lastId) break;
    lastId = nextCursor;

    if (records.length < pageSize) break;
  }

  logger.log(`[Stock] ${table}: carregados ${all.length}/${totalCount ?? '?'} registros (keyset)`);
  return all;
}

// ============================================
// PROCESSAMENTO DE DADOS
// ============================================

/**
 * Pares (qtd × data) de reposições futuras de um supplier source.
 *
 * A tabela Ouro `variant_supplier_sources` expõe até SEIS slots
 * (`next_quantity_1..6` / `next_date_1..6`). Centralizamos a extração aqui
 * para que `buildFutureEntries` (lista global) e a montagem de
 * `futureSegments` (por variação) leiam exatamente os mesmos slots — sem
 * dropar silenciosamente as chegadas 4–6 (bug histórico: só 1–3 eram lidas).
 */
function nextStockPairs(s: ExternalSupplierSource): Array<{
  q: number | null | undefined;
  d: string | null | undefined;
  suffix: string;
  status: 'confirmed' | 'pending';
}> {
  return [
    { q: s.next_quantity_1, d: s.next_date_1, suffix: '1', status: 'confirmed' },
    { q: s.next_quantity_2, d: s.next_date_2, suffix: '2', status: 'pending' },
    { q: s.next_quantity_3, d: s.next_date_3, suffix: '3', status: 'pending' },
    { q: s.next_quantity_4, d: s.next_date_4, suffix: '4', status: 'pending' },
    { q: s.next_quantity_5, d: s.next_date_5, suffix: '5', status: 'pending' },
    { q: s.next_quantity_6, d: s.next_date_6, suffix: '6', status: 'pending' },
  ];
}

function buildFutureEntries(
  supplierSource: ExternalSupplierSource,
  productId: string,
  variantId: string,
  colorName?: string,
  productName?: string,
  productSku?: string,
): FutureStockEntry[] {
  const entries: FutureStockEntry[] = [];
  const pairs = nextStockPairs(supplierSource);
  for (const { q, d, suffix, status } of pairs) {
    // BUG-STOCK-01 FIX: falsy check `if (q && d)` would skip q=0.
    // Use explicit null/undefined check instead.
    if (q !== null && q !== undefined && q > 0 && d) {
      entries.push({
        id: `${supplierSource.id}-${suffix}`,
        productId,
        variantId,
        colorName,
        productName,
        productSku,
        expectedQuantity: q,
        expectedDate: d,
        source: 'purchase_order',
        status,
        createdAt: supplierSource.updated_at || new Date().toISOString(),
        updatedAt: supplierSource.updated_at || new Date().toISOString(),
      });
    }
  }
  return entries;
}

export async function fetchAndProcessStockData(): Promise<{
  productStocks: ProductStockSummary[];
  alerts: StockAlert[];
  futureStock: FutureStockEntry[];
}> {
  const [allProducts, allVariants, allSupplierSources, allCategories, allSuppliers, allImages] =
    await Promise.all([
      fetchPaginatedFromBridge<ExternalProductWithVariants>(
        'products',
        'id,name,sku,min_quantity,stock_quantity,updated_at,category_id,supplier_id,brand',
        1000,
        100000,
        { active: true },
      ),
      fetchPaginatedFromBridge<ExternalVariantStock>(
        'product_variants',
        'id,product_id,sku,name,color_id,color_name,color_hex,color_code,stock_quantity,is_active,updated_at',
        1000,
        100000,
        { is_active: true },
      ),
      fetchPaginatedFromBridge<ExternalSupplierSource>(
        'variant_supplier_sources',
        'id,variant_id,supplier_id,supplier_sku,quantity,next_quantity_1,next_date_1,next_quantity_2,next_date_2,next_quantity_3,next_date_3,next_quantity_4,next_date_4,next_quantity_5,next_date_5,next_quantity_6,next_date_6,is_active,updated_at',
        1000,
        100000,
        { is_active: true },
      ),
      fetchPaginatedFromBridge<{ id: string; name: string }>('categories', 'id,name', 1000, 100000),
      fetchPaginatedFromBridge<{ id: string; name: string; code?: string }>(
        'suppliers',
        'id,name,code',
        1000,
        100000,
      ),
      // Imagens: 1 chamada agregada para enriquecer cards/linhas com thumb por produto
      // e por variante. Filtra image_type='box' no front (igual useExternalVariantStock).
      fetchPaginatedFromBridge<{
        id: string;
        product_id: string | null;
        variant_id: string | null;
        supplier_code: string | null;
        url_cdn: string | null;
        is_primary: boolean | null;
        is_og_image: boolean | null;
        image_type: string | null;
      }>(
        'product_images',
        'id,product_id,variant_id,supplier_code,url_cdn,is_primary,is_og_image,image_type',
        1000,
        200000,
      ).catch(
        () =>
          [] as Array<{
            id: string;
            product_id: string | null;
            variant_id: string | null;
            supplier_code: string | null;
            url_cdn: string | null;
            is_primary: boolean | null;
            is_og_image: boolean | null;
            image_type: string | null;
          }>,
      ),
    ]);

  // Build lookup maps for category and supplier names
  const categoryMap = new Map<string, string>();
  allCategories.forEach((c) => categoryMap.set(c.id, c.name));
  const supplierMap = new Map<string, string>();
  allSuppliers.forEach((s) => supplierMap.set(s.id, s.name));

  // Index images. Priorizamos: is_og_image > is_primary > qualquer outra.
  const productImageByProductId = new Map<string, string>();
  const imageByVariantId = new Map<string, string>();
  const imageBySupplierCode = new Map<string, string>();
  for (const img of allImages) {
    if (!img.url_cdn || img.image_type === 'box') continue;
    if (img.variant_id) {
      if (!imageByVariantId.has(img.variant_id) || img.is_og_image) {
        imageByVariantId.set(img.variant_id, img.url_cdn);
      }
    }
    if (img.supplier_code) {
      const code = img.supplier_code.toUpperCase();
      if (!imageBySupplierCode.has(code) || img.is_og_image) {
        imageBySupplierCode.set(code, img.url_cdn);
      }
    }
    if (img.product_id) {
      const existing = productImageByProductId.get(img.product_id);
      if (!existing || img.is_og_image || img.is_primary) {
        productImageByProductId.set(img.product_id, img.url_cdn);
      }
    }
  }

  logger.log(
    `[Stock] Carregados: ${allProducts.length} produtos, ${allVariants.length} variantes, ${allSupplierSources.length} sources, ${allImages.length} imagens`,
  );

  const variantsByProduct = new Map<string, ExternalVariantStock[]>();
  allVariants.forEach((v) => {
    if (!v.product_id) return;
    const existing = variantsByProduct.get(v.product_id) || [];
    existing.push(v);
    variantsByProduct.set(v.product_id, existing);
  });

  const sourcesByVariant = new Map<string, ExternalSupplierSource>();
  allSupplierSources.forEach((s) => {
    if (!s.variant_id) return;
    const existing = sourcesByVariant.get(s.variant_id);
    if (!existing || (s.updated_at && existing.updated_at && s.updated_at > existing.updated_at)) {
      sourcesByVariant.set(s.variant_id, s);
    }
  });

  const futureEntries: FutureStockEntry[] = [];

  if (allProducts.length === 0) {
    return { productStocks: [], alerts: [], futureStock: [] };
  }

  const summaries: ProductStockSummary[] = allProducts.map((product) => {
    const productVariants = variantsByProduct.get(product.id) || [];
    const variants: VariantStock[] = [];

    if (productVariants.length > 0) {
      productVariants.forEach((pv) => {
        const supplierSource = sourcesByVariant.get(pv.id);
        const currentStock = supplierSource
          ? toNumber(supplierSource.quantity, toNumber(pv.stock_quantity, 0))
          : toNumber(pv.stock_quantity, 0);
        // BUG-STOCK-02 FIX: `|| 10` would use 10 when min_quantity is explicitly 0.
        // Use nullish coalescing to preserve intentional zero.
        const minStock = product.min_quantity ?? 10;
        // Reservas não existem na camada Ouro (sem coluna reserved_quantity).
        const reservedStock = 0;
        let inTransitStock = 0;
        const futureSegments: Array<{ quantity: number; date: string }> = [];

        if (supplierSource) {
          // Constrói segmentos granulares (qtd × data) preservando a data de
          // CADA chegada (slots 1–6). `inTransitStock` mantém o total agregado
          // (display), mas a janela de Estoque Futuro passa a somar por data
          // via segmentos.
          for (const { q, d } of nextStockPairs(supplierSource)) {
            if (q !== null && q !== undefined && q > 0) {
              inTransitStock += q;
              if (d) futureSegments.push({ quantity: q, date: d });
            }
          }
          futureEntries.push(
            ...buildFutureEntries(
              supplierSource,
              product.id,
              pv.id,
              pv.color_name || undefined,
              product.name,
              product.sku,
            ),
          );
        }

        const availableStock = calculateAvailableStock(currentStock, reservedStock);
        const status = calculateStockStatus(currentStock, minStock, undefined, inTransitStock);

        const variantImage =
          imageByVariantId.get(pv.id) ||
          (pv.color_code ? imageBySupplierCode.get(pv.color_code.toUpperCase()) : undefined) ||
          undefined;

        variants.push({
          id: pv.id,
          productId: product.id,
          variantId: pv.id,
          variantSku: pv.sku || `${product.sku}-${pv.color_code || 'VAR'}`,
          imageUrl: variantImage,
          colorId: pv.color_id,
          colorName: pv.color_name || 'Padrao',
          colorHex: pv.color_hex,
          currentStock,
          minStock,
          reservedStock,
          inTransitStock,
          availableStock,
          status,
          daysUntilStockout: calculateDaysUntilStockout(availableStock),
          futureStock: inTransitStock > 0 ? inTransitStock : undefined,
          futureStockDate: supplierSource?.next_date_1 || undefined,
          futureSegments: futureSegments.length > 0 ? futureSegments : undefined,
          updatedAt: pv.updated_at || product.updated_at || new Date().toISOString(),
        });
      });

      // Fallback: estoque no nivel do produto
      const productLevelStock = toNumber(product.stock_quantity, 0);
      const sumVariantStock = variants.reduce((sum, v) => sum + toNumber(v.currentStock, 0), 0);

      if (sumVariantStock === 0 && productLevelStock > 0) {
        // BUG-STOCK-02 FIX: also use ?? here for consistency
        const minStock = product.min_quantity ?? 10;
        if (variants.length === 1) {
          variants[0] = {
            ...variants[0],
            currentStock: productLevelStock,
            availableStock: calculateAvailableStock(productLevelStock, variants[0].reservedStock),
            status: calculateStockStatus(productLevelStock, minStock),
            daysUntilStockout: calculateDaysUntilStockout(productLevelStock),
          };
        } else {
          const availableStock = calculateAvailableStock(productLevelStock, 0);
          variants.push({
            id: `${product.id}::product_total`,
            productId: product.id,
            variantId: `${product.id}::product_total`,
            variantSku: product.sku || 'PROD',
            colorName: 'Total do Produto',
            currentStock: productLevelStock,
            minStock,
            reservedStock: 0,
            inTransitStock: 0,
            availableStock,
            status: calculateStockStatus(productLevelStock, minStock),
            daysUntilStockout: calculateDaysUntilStockout(availableStock),
            updatedAt: product.updated_at || new Date().toISOString(),
          });
        }
      }
    } else {
      const currentStock = toNumber(product.stock_quantity, 0);
      // BUG-STOCK-02 FIX: ?? instead of ||
      const minStock = product.min_quantity ?? 10;
      const availableStock = calculateAvailableStock(currentStock, 0);
      variants.push({
        id: product.id,
        productId: product.id,
        variantId: product.id,
        variantSku: product.sku || 'PROD',
        colorName: 'Padrao',
        currentStock,
        minStock,
        reservedStock: 0,
        inTransitStock: 0,
        availableStock,
        status: calculateStockStatus(currentStock, minStock),
        daysUntilStockout: calculateDaysUntilStockout(availableStock),
        updatedAt: product.updated_at || new Date().toISOString(),
      });
    }

    const aggregated = aggregateVariantsToProduct(variants);
    const categoryName = product.category_id ? categoryMap.get(product.category_id) : undefined;
    const supplierName = product.supplier_id
      ? supplierMap.get(product.supplier_id)
      : product.brand || undefined;
    const productImageUrl =
      productImageByProductId.get(product.id) ||
      variants.find((v) => v.imageUrl)?.imageUrl ||
      undefined;
    return {
      productId: product.id,
      productName: product.name,
      productSku: product.sku || '',
      productImageUrl,
      categoryName,
      supplierName,
      ...aggregated,
    };
  });

  const alerts = generateStockAlerts(summaries);
  logger.log(
    `[Stock] Processados ${summaries.length} produtos com ${futureEntries.length} previsoes`,
  );
  return { productStocks: summaries, alerts, futureStock: futureEntries };
}

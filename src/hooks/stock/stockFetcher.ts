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
  color_group?: string;
  size_code?: string;
  size_name?: string;
  stock_quantity: number;
  is_active?: boolean;
  updated_at?: string;
}

/** Linha de `variant_supplier_sources` (Ouro) com quantidades futuras por fonte de fornecedor. */
export interface ExternalSupplierSource {
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

/**
 * Linha de `mv_stock_velocity` (Ouro/Medallion) — velocidade real de baixa
 * por variação, calculada a partir de `stock_snapshots`/movimentos. É a fonte
 * canônica do "Risco de Ruptura" (média diária de baixa nos últimos 7/30/90d).
 * O `id` é alias do PK (`variant_supplier_source_id`) para a paginação genérica.
 */
export interface ExternalStockVelocity {
  id: string;
  variant_id: string | null;
  avg_daily_depletion_7d: number | null;
  avg_daily_depletion_30d: number | null;
}

/** Converte qualquer valor para número finito, retornando `fallback` (padrão 0) em caso de NaN ou Infinity. */
export function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Índice de baixa diária real por `variant_id`, a partir das linhas de
 * `mv_stock_velocity`.
 *
 * Regras (SSOT do Risco de Ruptura):
 *  - prioriza a média de 30 dias; cai para 7 dias quando 30d ainda não
 *    consolidou (ex.: variação recém-criada);
 *  - ignora valores ≤ 0, nulos ou não-finitos (ausência de sinal);
 *  - com múltiplos sources por variação, mantém a MAIOR baixa (pior caso →
 *    previsão de ruptura mais conservadora).
 */
export function buildVelocityIndex(rows: ExternalStockVelocity[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const v of rows) {
    if (!v?.variant_id) continue;
    const daily = toNumber(v.avg_daily_depletion_30d, 0) || toNumber(v.avg_daily_depletion_7d, 0);
    if (daily <= 0) continue;
    const prev = index.get(v.variant_id) ?? 0;
    if (daily > prev) index.set(v.variant_id, daily);
  }
  return index;
}

// ============================================
// BUSCA PAGINADA
// ============================================

/**
 * Colunas permitidas como filtros por tabela lógica (pré-GOLD_READ_ALIASES).
 * Defesa em profundidade: impede que colunas arbitrárias sejam injetadas via
 * parâmetro `filters` de fetchPaginatedFromBridge. Tabelas ausentes → sem restrição.
 */
// Inclui apenas tabelas chamadas com filtros em produção. Tabelas ausentes
// (categories, suppliers, product_images, mv_stock_velocity) não recebem
// filtros e portanto não precisam de restrição.
export const ALLOWED_FILTER_KEYS: Readonly<Record<string, ReadonlySet<string>>> = {
  products: new Set(['active', 'is_active', 'supplier_id', 'category_id', 'brand']),
  product_variants: new Set(['is_active', 'product_id', 'color_id', 'supplier_id']),
  variant_supplier_sources: new Set(['is_active', 'variant_id', 'supplier_id']),
};

/** Busca paginada por keyset (`id`) via PostgREST direto (ponte descontinuada), com deduplicação. */
export async function fetchPaginatedFromBridge<T extends { id: string }>(
  table: string,
  select: string,
  pageSize = 1000,
  maxRecords = 100000,
  filters?: Record<string, unknown>,
  keysetColumn = 'id',
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
    let query = untypedFrom(resolvedTable).select(
      select,
      lastId === null ? { count: 'exact' } : undefined,
    );

    if (filters) {
      const allowed = ALLOWED_FILTER_KEYS[table];
      for (const [col, val] of Object.entries(filters)) {
        if (allowed !== undefined && !allowed.has(col)) {
          logger.warn(
            `[Stock] fetchPaginatedFromBridge: coluna de filtro não permitida "${col}" em "${table}" — ignorado`,
          );
          continue;
        }
        if (val === null) query = query.is(col, null);
        else if (Array.isArray(val)) query = query.in(col, val);
        else query = query.eq(col, val);
      }
    }

    // Cursor estável: ordena pela coluna de keyset (PK físico) e busca a próxima
    // página após o último cursor visto. Views Ouro sem coluna `id` física (ex.:
    // mv_stock_velocity, cujo PK é variant_supplier_source_id) passam o nome real
    // via `keysetColumn`; o `select` continua expondo o valor como `id` na saída.
    query = query.order(keysetColumn, { ascending: true }).limit(pageSize);
    if (lastId !== null) query = query.gt(keysetColumn, lastId);

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

    // Otimização: se o total já é conhecido e já buscamos tudo, não faz mais
    // um round-trip para confirmar página vazia.
    if (totalCount !== null && all.length >= totalCount) break;

    const nextCursor = records[records.length - 1]?.id ?? null;
    // Segurança: se o cursor não avançou, paramos para não loopar.
    if (nextCursor === null || nextCursor === lastId) {
      logger.warn(`[Stock] ${table}: cursor preso em "${nextCursor}" — interrompendo paginação.`);
      break;
    }
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
export function nextStockPairs(s: ExternalSupplierSource): Array<{
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

/** Converte os campos next_quantity_N/next_date_N de uma source em entradas de estoque futuro. */
export function buildFutureEntries(
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

/**
 * Busca em paralelo todas as entidades do estoque e as processa em
 * `productStocks`, `alerts` e `futureStock`.
 *
 * Tolerância a falhas por tabela:
 *  - `products` / `product_variants` — críticas: se falharem, a Promise rejeita.
 *  - `variant_supplier_sources` — semi-crítica: se falhar, usa stock_quantity
 *    das variações diretamente (sem agregação multi-fornecedor).
 *  - `categories` / `suppliers` — opcionais: se falharem, exibe produtos sem
 *    nomes de categoria/fornecedor.
 *  - `product_images` / `mv_stock_velocity` — já possuem fallback interno.
 * Tabelas degradadas são listadas em `degradedTables` no retorno.
 */
export async function fetchAndProcessStockData(): Promise<{
  productStocks: ProductStockSummary[];
  alerts: StockAlert[];
  futureStock: FutureStockEntry[];
  degradedTables: string[];
}> {
  const t0 = performance.now();
  const degradedTables: string[] = [];
  const graceful =
    <T>(table: string) =>
    (err: unknown): T[] => {
      logger.warn(
        `[Stock] ${table}: falha parcial — degradado, continuando sem dados desta tabela.`,
        err,
      );
      degradedTables.push(table);
      return [];
    };

  const [
    allProducts,
    allVariants,
    allSupplierSources,
    allCategories,
    allSuppliers,
    allImages,
    allVelocity,
  ] = await Promise.all([
    fetchPaginatedFromBridge<ExternalProductWithVariants>(
      'products',
      'id,name,sku,min_quantity,stock_quantity,updated_at,category_id,supplier_id,brand',
      1000,
      100000,
      { active: true },
    ),
    fetchPaginatedFromBridge<ExternalVariantStock>(
      'product_variants',
      'id,product_id,sku,name,color_id,color_name,color_hex,color_code,size_code,stock_quantity,is_active,updated_at',
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
    ).catch(graceful<ExternalSupplierSource>('variant_supplier_sources')),
    fetchPaginatedFromBridge<{ id: string; name: string }>(
      'categories',
      'id,name',
      1000,
      100000,
    ).catch(graceful<{ id: string; name: string }>('categories')),
    fetchPaginatedFromBridge<{ id: string; name: string; code?: string }>(
      'suppliers',
      'id,name,code',
      1000,
      100000,
    ).catch(graceful<{ id: string; name: string; code?: string }>('suppliers')),
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
    // Velocidade real de baixa (mv_stock_velocity). Alimenta avgDailySales →
    // Risco de Ruptura preditivo + dias-até-esgotar reais. Tolerante a falha:
    // se a view não estiver disponível, caímos no comportamento sem velocidade.
    fetchPaginatedFromBridge<ExternalStockVelocity>(
      'mv_stock_velocity',
      'id:variant_supplier_source_id,variant_id,avg_daily_depletion_7d,avg_daily_depletion_30d',
      1000,
      100000,
      undefined,
      // BUGFIX: a view não tem coluna física `id`; o keyset precisa ordenar pelo PK real.
      'variant_supplier_source_id',
    ).catch(() => [] as ExternalStockVelocity[]),
  ]);

  const tFetch = performance.now();
  // Build lookup maps for category and supplier names
  const categoryMap = new Map<string, string>();
  allCategories.forEach((c) => categoryMap.set(c.id, c.name));
  const supplierMap = new Map<string, string>();
  allSuppliers.forEach((s) => supplierMap.set(s.id, s.name));

  // Velocidade real por variação (mv_stock_velocity) → avgDailySales.
  const velocityByVariant = buildVelocityIndex(allVelocity);

  // Index images. Priorizamos: is_og_image > is_primary > qualquer outra.
  const productImageByProductId = new Map<string, string>();
  // BUG-G FIX: rastreia quais produtos têm og como imagem principal.
  // Sem esse controle, is_primary pode sobrescrever is_og_image quando a imagem
  // og chegou primeiro na paginação (keyset não garante ordem og-antes-primary
  // para o mesmo produto).
  const productImageIsOg = new Set<string>();
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
      const existingIsOg = productImageIsOg.has(img.product_id);
      if (
        !productImageByProductId.has(img.product_id) ||
        (img.is_og_image && !existingIsOg) ||
        (!existingIsOg && img.is_primary)
      ) {
        productImageByProductId.set(img.product_id, img.url_cdn);
        if (img.is_og_image) productImageIsOg.add(img.product_id);
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

  // BUG-3 FIX: a variant can have sources from multiple suppliers. Accumulate
  // the total quantity across all active sources; keep the most-recently-updated
  // source record for metadata (future stock dates, supplier_sku, etc.).
  // BUG-H FIX: store ALL sources per variant so future-stock slots from ALL
  // suppliers are aggregated into inTransitStock/futureSegments. Previously only
  // the most-recently-updated supplier's slots were counted, silently dropping
  // incoming stock from older-updated suppliers.
  const allSourcesByVariant = new Map<string, ExternalSupplierSource[]>();
  const sourceQtyByVariant = new Map<string, number>();
  allSupplierSources.forEach((s) => {
    if (!s.variant_id) return;
    sourceQtyByVariant.set(
      s.variant_id,
      (sourceQtyByVariant.get(s.variant_id) ?? 0) + (s.quantity || 0),
    );
    const list = allSourcesByVariant.get(s.variant_id) ?? [];
    list.push(s);
    allSourcesByVariant.set(s.variant_id, list);
  });

  const futureEntries: FutureStockEntry[] = [];

  if (allProducts.length === 0) {
    return { productStocks: [], alerts: [], futureStock: [], degradedTables };
  }

  const summaries: ProductStockSummary[] = allProducts.map((product) => {
    const productVariants = variantsByProduct.get(product.id) || [];
    const variants: VariantStock[] = [];

    if (productVariants.length > 0) {
      productVariants.forEach((pv) => {
        const variantSources = allSourcesByVariant.get(pv.id) ?? [];
        // Most-recently-updated source provides metadata (futureStockDate, supplier_sku).
        const supplierSource =
          variantSources.length > 0
            ? variantSources.reduce((best, s) =>
                (s.updated_at ?? '') > (best.updated_at ?? '') ? s : best,
              )
            : undefined;
        const currentStock =
          variantSources.length > 0
            ? toNumber(sourceQtyByVariant.get(pv.id), toNumber(pv.stock_quantity, 0))
            : toNumber(pv.stock_quantity, 0);
        // BUG-STOCK-02 FIX: `|| 10` would use 10 when min_quantity is explicitly 0.
        // Use nullish coalescing to preserve intentional zero.
        const minStock = product.min_quantity ?? 10;
        // Reservas não existem na camada Ouro (sem coluna reserved_quantity).
        const reservedStock = 0;
        let inTransitStock = 0;
        const futureSegments: Array<{ quantity: number; date: string }> = [];

        // BUG-H FIX: iterate ALL supplier sources so future-stock slots from
        // every supplier are included in inTransitStock and futureSegments.
        for (const src of variantSources) {
          // Constrói segmentos granulares (qtd × data) preservando a data de
          // CADA chegada (slots 1–6). `inTransitStock` mantém o total agregado
          // (display), mas a janela de Estoque Futuro passa a somar por data
          // via segmentos.
          for (const { q, d } of nextStockPairs(src)) {
            if (q !== null && q !== undefined && q > 0) {
              inTransitStock += q;
              if (d) futureSegments.push({ quantity: q, date: d });
            }
          }
          futureEntries.push(
            ...buildFutureEntries(
              src,
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

        // Velocidade real → alimenta Risco de Ruptura e dias-até-esgotar.
        // Sem sinal (variação nova/sem baixa) mantém o fallback histórico.
        const avgDaily = velocityByVariant.get(pv.id);
        const hasVelocity = typeof avgDaily === 'number' && avgDaily > 0;

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
          colorName: pv.color_name || 'Padrão',
          colorHex: pv.color_hex,
          colorGroup: pv.color_group || undefined,
          sizeName: pv.size_name || undefined,
          sizeCode: pv.size_code || undefined,
          currentStock,
          minStock,
          reservedStock,
          inTransitStock,
          availableStock,
          status,
          avgDailySales: hasVelocity ? avgDaily : undefined,
          daysUntilStockout: calculateDaysUntilStockout(
            availableStock,
            hasVelocity ? avgDaily : undefined,
          ),
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
        colorName: 'Padrão',
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
      categoryId: product.category_id,
      categoryName,
      supplierName,
      ...aggregated,
    };
  });

  const tProcess = performance.now();
  const alerts = generateStockAlerts(summaries);
  const tAlerts = performance.now();

  logger.log('[Stock] perf', {
    fetchMs: Math.round(tFetch - t0),
    processMs: Math.round(tProcess - tFetch),
    alertsMs: Math.round(tAlerts - tProcess),
    totalMs: Math.round(tAlerts - t0),
    products: allProducts.length,
    variants: allVariants.length,
    sources: allSupplierSources.length,
    futureEntries: futureEntries.length,
    alerts: alerts.length,
    ...(degradedTables.length > 0 && { degradedTables }),
  });

  return { productStocks: summaries, alerts, futureStock: futureEntries, degradedTables };
}

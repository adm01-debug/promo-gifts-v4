import { getCatalogStockStatus } from '@/lib/catalog-stock-status';
import { useQuery } from '@tanstack/react-query';
import { resolveTable, handleQueryError } from '@/lib/supabase-direct';
import { untypedFrom } from '@/lib/supabase-untyped';
import { compareNamePtBR } from '@/utils/product-sorting';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

const fromTable = (table: string) => untypedFrom(resolveTable(table));

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// FIX (auditoria Novidades 2026-06-18, P0): a fonte da verdade de "novidade" é a
// PIPELINE do banco (colunas `is_new` / `novelty_detected_at` /
// `novelty_expires_at`, mantidas pelo trigger fn_set_product_as_new + cron
// cleanup-novelties), e NÃO uma janela de 30 dias derivada de `created_at`.
// A implementação anterior usava `created_at + 30d`, o que: (1) ocultava ~16%
// das novidades reais — produtos detectados como novidade DEPOIS de criados no
// catálogo (lag médio de ~21 dias, até 132); (2) media a idade do badge a partir
// da criação no catálogo, não da detecção como novidade.
//
// A janela do trigger DB (fn_set_product_as_new) é de 30 dias. A UX (badge
// "Novidade X dias", faixas de cor, destaque "recém-chegado") permanece ancorada
// em DETECÇÃO recente, fiel ao dado: toda novidade ativa foi detectada há ≤ 30d.
const NOVELTY_DISPLAY_WINDOW_DAYS = 30; // fallback quando novelty_expires_at vier nulo
const NOVELTY_FRESH_DAYS = 5; // "recém-chegado" = detectado há ≤ 5 dias
const NOVELTY_EXPIRING_SOON_DAYS = 7; // "expirando" = expira em ≤ 7 dias

const NOVELTY_SELECT =
  'id, name, sku, primary_image_url, set_image_url, sale_price, category_id, supplier_id, created_at, stock_quantity, min_quantity, is_new, novelty_detected_at, novelty_expires_at';

/**
 * Filtros de qualidade aplicados a TODOS os hooks de novidades.
 * - is_stockout=false  → produto em stockout não é novidade
 * - sale_price > 0     → produto sem preço não aparece como novidade
 * - primary_image_url  → produto sem imagem não aparece como novidade
 */
// PostgrestFilterBuilder (post-select) exposes eq/not/gt/gte/lte/order/range.
// Using direct import avoids TS2589 (excessive type instantiation depth) from
// ReturnType<ReturnType<typeof fromTable>['select']> nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NoveltyQuery = PostgrestFilterBuilder<any, any, any, any, any, unknown, 'GET'>;

const applyNoveltyQualityFilters = (query: NoveltyQuery): NoveltyQuery =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (query as any)
    .eq('is_stockout', false)
    .not('primary_image_url', 'is', null)
    .gt('sale_price', 0) as NoveltyQuery;

/**
 * Predicado de PERTINÊNCIA de novidade (fonte da verdade = pipeline DB).
 * Um produto ativo é novidade enquanto a flag `is_new` estiver ligada E a data
 * de expiração for futura. Combinar ambos torna o resultado:
 *  - respeitoso a remoções manuais (admin desliga `is_new`);
 *  - auto-corretivo entre execuções do cron (`novelty_expires_at > now`
 *    descarta flags vencidas mesmo antes do `cleanup-novelties` rodar).
 * Os filtros de qualidade continuam aplicados.
 */
const applyNoveltyPredicate = (query: NoveltyQuery, nowIso: string): NoveltyQuery =>
  applyNoveltyQualityFilters(query.eq('is_active', true) as NoveltyQuery)
    .eq('is_new', true)
    .gt('novelty_expires_at', nowIso) as NoveltyQuery;

/**
 * Dias restantes como novidade — derivado da expiração REAL da pipeline.
 * Clampa em 0 (nunca negativo).
 */
function calcDaysRemaining(expiresAt: string | null | undefined): number {
  if (!expiresAt) return 0;
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return 0;
  const ms = exp - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / MS_PER_DAY);
}

/**
 * Dias decorridos desde a DETECÇÃO como novidade (idade do badge "Novidade X
 * dias"). Guard contra datas no futuro (elapsed < 0 → 0).
 */
function calcDaysAsNovelty(detectedAt: string | null | undefined): number {
  if (!detectedAt) return 0;
  const det = new Date(detectedAt).getTime();
  if (Number.isNaN(det)) return 0;
  const elapsed = Math.floor((Date.now() - det) / MS_PER_DAY);
  return elapsed < 0 ? 0 : elapsed;
}

/**
 * Interface para novidade com dados do produto externo
 */
export interface NoveltyWithDetails {
  novelty_id: string;
  product_id: string;
  product_sku: string | null;
  product_name: string;
  product_description: string | null;
  base_price: number | null;
  product_image: string | null;
  product_set_image: string | null;
  category_id: string | null;
  category_name: string | null;
  supplier_code: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_product_code: string | null;
  detected_at: string;
  expires_at: string;
  days_remaining: number;
  /** Dias decorridos desde a detecção como novidade (idade do badge). */
  days_as_novelty: number;
  status: 'active' | 'expiring_soon' | 'expired';
  is_highlighted: boolean;
  is_active: boolean;
  stock_quantity: number;
  min_quantity: number;
  stock_status: 'in-stock' | 'low-stock' | 'out-of-stock';
}

/**
 * Interface normalizada para exibição de estatísticas
 */
export interface NoveltyStatsDisplay {
  totalNovelties: number;
  activeNovelties: number;
  expiringSoon: number;
  totalProducts: number;
  noveltyRate: number;
  /** Arrival-focused stats */
  arrivedToday: number;
  arrivedThisWeek: number;
  arrivedLast15Days: number;
  topSupplierName: string | null;
  topSupplierCount: number;
  /** Ranking de fornecedores das novidades (server-side, conjunto completo). */
  supplierBreakdown: NoveltySupplierBreakdown[];
}

/** Item do ranking "Por Fornecedor" exibido na sidebar de Novidades. */
export interface NoveltySupplierBreakdown {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export interface RawProduct {
  id: string;
  name: string;
  sku: string | null;
  primary_image_url: string | null;
  set_image_url?: string | null;
  sale_price: number | null;
  category_id: string | null;
  supplier_id: string | null;
  created_at: string;
  stock_quantity: number | null;
  min_quantity: number | null;
  is_new?: boolean | null;
  novelty_detected_at?: string | null;
  novelty_expires_at?: string | null;
}

interface CategoryRecord {
  id: string;
  name: string;
}
interface SupplierRecord {
  id: string;
  name: string;
  code?: string;
}

/**
 * Enriquece novidades com nomes de categoria e fornecedor
 */
async function enrichNovelties(novelties: NoveltyWithDetails[]): Promise<NoveltyWithDetails[]> {
  const categoryIds = [...new Set(novelties.map((n) => n.category_id).filter(Boolean))] as string[];
  const supplierIds = [...new Set(novelties.map((n) => n.supplier_id).filter(Boolean))] as string[];

  const [catRecords, supRecords] = await Promise.all([
    categoryIds.length > 0
      ? (async () => {
          const { data, error } = await fromTable('categories')
            .select('id, name')
            .in('id', categoryIds);
          if (error) return handleQueryError('useNovelties', 'categories', error);
          return (data ?? []) as unknown as CategoryRecord[];
        })()
      : Promise.resolve([] as CategoryRecord[]),
    supplierIds.length > 0
      ? (async () => {
          const { data, error } = await fromTable('suppliers')
            .select('id, name, code')
            .in('id', supplierIds);
          if (error) return handleQueryError('useNovelties', 'suppliers', error);
          return (data ?? []) as unknown as SupplierRecord[];
        })()
      : Promise.resolve([] as SupplierRecord[]),
  ]);

  const catMap = new Map(catRecords.map((c) => [c.id, c.name]));
  const supMap = new Map(supRecords.map((s) => [s.id, { name: s.name, code: s.code }]));

  return novelties.map((n) => ({
    ...n,
    category_name: (n.category_id && catMap.get(n.category_id)) || null,
    supplier_name: (n.supplier_id && supMap.get(n.supplier_id)?.name) || null,
    supplier_code: (n.supplier_id && supMap.get(n.supplier_id)?.code) || null,
  }));
}

/**
 * Converte produto cru em NoveltyWithDetails usando os sinais da pipeline DB.
 * - `detected_at`  = novelty_detected_at (fallback created_at)
 * - `expires_at`   = novelty_expires_at  (fallback detected + janela display)
 * - `days_remaining` (REAL) = dias até a expiração da pipeline
 * - `days_as_novelty`       = dias desde a detecção (idade do badge)
 */
export function toNovelty(p: RawProduct): NoveltyWithDetails {
  const detectedAt = p.novelty_detected_at ?? p.created_at;
  const expiresAt =
    p.novelty_expires_at ??
    new Date(
      new Date(detectedAt).getTime() + NOVELTY_DISPLAY_WINDOW_DAYS * MS_PER_DAY,
    ).toISOString();

  const daysRemaining = calcDaysRemaining(expiresAt);
  const daysAsNovelty = calcDaysAsNovelty(detectedAt);
  const stock = p.stock_quantity ?? 0;
  const minQty = p.min_quantity ?? 10;
  const stockStatus: NoveltyWithDetails['stock_status'] = getCatalogStockStatus(stock, minQty);

  return {
    novelty_id: p.id,
    product_id: p.id,
    product_sku: p.sku,
    product_name: p.name,
    product_description: null,
    base_price: p.sale_price,
    product_image: p.primary_image_url,
    product_set_image: p.set_image_url ?? null,
    category_id: p.category_id,
    category_name: null,
    supplier_code: null,
    supplier_id: p.supplier_id,
    supplier_name: null,
    supplier_product_code: null,
    detected_at: detectedAt,
    expires_at: expiresAt,
    days_remaining: daysRemaining,
    days_as_novelty: daysAsNovelty,
    status:
      daysRemaining <= 0
        ? 'expired'
        : daysRemaining <= NOVELTY_EXPIRING_SOON_DAYS
          ? 'expiring_soon'
          : 'active',
    // "Recém-chegado": detectado há poucos dias (não derivado da expiração, que
    // reflete a janela de 30 dias do trigger fn_set_product_as_new).
    is_highlighted: daysAsNovelty <= NOVELTY_FRESH_DAYS,
    is_active: daysRemaining > 0,
    stock_quantity: stock,
    min_quantity: minQty,
    stock_status: stockStatus,
  };
}

/**
 * Ordena novidades pelos campos REAIS de NoveltyWithDetails (mutação in-place).
 * Nota: diferente de sortProducts (não-mutante desde PR #915), sortNovelties
 * modifica o array passado diretamente e o retorna.
 *
 * FIX (auditoria Novidades 2026-06-18, P1): o grid antes fazia
 * `sortProducts(novelties as unknown as Product[])`, mas as formas divergem
 * (`product_name`≠`name`, `base_price`≠`price`, `detected_at`≠`created_at`),
 * então TODAS as ordenações eram no-op silencioso — "Mais recentes" caía em A-Z.
 */
export function sortNovelties(
  novelties: NoveltyWithDetails[],
  sortBy: string,
): NoveltyWithDetails[] {
  const byNameThenId = (a: NoveltyWithDetails, b: NoveltyWithDetails): number => {
    const byName = compareNamePtBR(a.product_name, b.product_name);
    if (byName !== 0) return byName;
    return a.product_id < b.product_id ? -1 : a.product_id > b.product_id ? 1 : 0;
  };

  switch (sortBy) {
    case 'newest':
      novelties.sort((a, b) => {
        const bt = new Date(b.detected_at).getTime();
        const at = new Date(a.detected_at).getTime();
        if (bt !== at) return bt - at;
        return byNameThenId(a, b);
      });
      break;
    case 'name':
    case 'name-asc':
      novelties.sort(byNameThenId);
      break;
    case 'name-desc':
      novelties.sort((a, b) => byNameThenId(b, a));
      break;
    case 'price-asc':
      novelties.sort((a, b) => {
        const d = (a.base_price ?? 0) - (b.base_price ?? 0);
        return d !== 0 ? d : byNameThenId(a, b);
      });
      break;
    case 'price-desc':
      novelties.sort((a, b) => {
        const d = (b.base_price ?? 0) - (a.base_price ?? 0);
        return d !== 0 ? d : byNameThenId(a, b);
      });
      break;
    case 'stock':
      novelties.sort((a, b) => {
        const d = (b.stock_quantity ?? 0) - (a.stock_quantity ?? 0);
        return d !== 0 ? d : byNameThenId(a, b);
      });
      break;
    default:
      // Valor desconhecido → no-op (preserva ordem), igual a sortProducts.
      break;
  }
  return novelties;
}

export interface UseNoveltiesOptions {
  limit?: number;
  offset?: number;
  onlyHighlighted?: boolean;
}

/**
 * Hook para buscar novidades — produtos sinalizados como novidade pela pipeline
 * DB (is_new + novelty_expires_at futuro).
 * Aplica filtros de qualidade: não stockout, com imagem, com preço.
 */
export function useNoveltiesWithDetails(options: UseNoveltiesOptions = {}) {
  const { limit, onlyHighlighted = false } = options;

  return useQuery<NoveltyWithDetails[]>({
    queryKey: ['novelties-details', limit ?? 'all', onlyHighlighted],
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      // FIX (auditoria Novidades, P1-B): paginacao completa. `limit`, quando
      // informado, atua como teto opcional para previews (home/sidebar).
      // FIX (P0): pertinência via pipeline (is_new + novelty_expires_at > now),
      // não mais janela de created_at.
      const PAGE = 1000;
      const MAX_PAGES = 25; // anti-loop: teto ~25k
      const hardCap = typeof limit === 'number' ? limit : Number.POSITIVE_INFINITY;
      const records: RawProduct[] = [];
      let from = 0;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const want = Math.min(PAGE, hardCap - records.length);
        if (want <= 0) break;
        const { data, error } = await applyNoveltyPredicate(
          fromTable('products').select(NOVELTY_SELECT),
          nowIso,
        )
          .order('novelty_detected_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + want - 1);
        if (error) return handleQueryError('useNovelties', 'products', error);
        const rows = (data ?? []) as unknown as RawProduct[];
        records.push(...rows);
        from += rows.length;
        // Para em página vazia OU página incompleta (ambos indicam fim dos dados).
        if (rows.length < want) break;
      }

      let novelties = records.map(toNovelty).filter((n) => n.is_active);

      if (onlyHighlighted) {
        novelties = novelties.filter((n) => n.is_highlighted);
      }

      return enrichNovelties(novelties);
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook para buscar novidades expirando em breve (≤ maxDays restantes).
 * Aplica filtros de qualidade: não stockout, com imagem, com preço.
 */
export function useExpiringNovelties(maxDays: number = 7) {
  return useQuery<NoveltyWithDetails[]>({
    queryKey: ['expiring-novelties', maxDays],
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      // Busca paginada — sem hardcap para não perder produtos expirando
      const PAGE_SIZE = 500;
      const allRaw: RawProduct[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await applyNoveltyPredicate(
          fromTable('products').select(NOVELTY_SELECT),
          nowIso,
        )
          .order('novelty_expires_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) return handleQueryError('useNovelties', 'products', error);
        const rows = (data ?? []) as unknown as RawProduct[];
        allRaw.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        // early exit: todos os restantes têm novelty_expires_at além de maxDays
        const lastRow = rows[rows.length - 1] as RawProduct & { novelty_expires_at?: string };
        if (lastRow?.novelty_expires_at) {
          const daysLeft =
            (new Date(lastRow.novelty_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (daysLeft > maxDays) break;
        }
        offset += PAGE_SIZE;
      }

      return allRaw
        .map(toNovelty)
        .filter((n) => n.is_active && n.days_remaining <= maxDays)
        .sort((a, b) => a.days_remaining - b.days_remaining);
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook para estatísticas de novidades — contagens 100% server-side, sem limite artificial.
 * Filtros de qualidade aplicados: is_stockout=false, sale_price>0, primary_image_url IS NOT NULL.
 * Alinha os counts do frontend com a fonte canonica is_new (product_novelties via trigger).
 */
export function useNoveltyStats() {
  return useQuery<NoveltyStatsDisplay>({
    queryKey: ['novelty-stats'],
    queryFn: async () => {
      const now = new Date();
      const nowIso = now.toISOString();
      // Janelas de "chegada" ancoradas na DETECÇÃO como novidade (pipeline),
      // não na criação no catálogo — consistente com o grid e os badges.
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6,
      ).toISOString();
      const fifteenStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 14,
      ).toISOString();
      // "Expirando em breve" = expira dentro dos próximos N dias (expiração real).
      const expiringSoonLimit = new Date(
        now.getTime() + NOVELTY_EXPIRING_SOON_DAYS * MS_PER_DAY,
      ).toISOString();

      const emptyStats: NoveltyStatsDisplay = {
        totalNovelties: 0,
        activeNovelties: 0,
        expiringSoon: 0,
        totalProducts: 0,
        noveltyRate: 0,
        arrivedToday: 0,
        arrivedThisWeek: 0,
        arrivedLast15Days: 0,
        topSupplierName: null,
        topSupplierCount: 0,
        supplierBreakdown: [],
      };

      // Helper: query base de NOVIDADE (pipeline + qualidade) para HEAD counts.
      const noveltyBase = () =>
        applyNoveltyPredicate(
          fromTable('products').select('id', { count: 'exact', head: true }),
          nowIso,
        );

      const [todayRes, weekRes, fifteenRes, activeRes, expiringSoonRes, totalRes] =
        await Promise.all([
          // Detectadas como novidade hoje
          noveltyBase().gte('novelty_detected_at', todayStart),
          // Detectadas nos últimos 7 dias
          noveltyBase().gte('novelty_detected_at', weekStart),
          // Detectadas nos últimos 15 dias
          noveltyBase().gte('novelty_detected_at', fifteenStart),
          // Novidades ativas (conjunto da pipeline, sem janela artificial)
          noveltyBase(),
          // Expirando em breve (expira dentro dos próximos N dias)
          noveltyBase().lte('novelty_expires_at', expiringSoonLimit),
          // Total do catálogo ativo (sem filtros — denominador real)
          fromTable('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ]);

      if (todayRes.error) {
        handleQueryError('useNovelties', 'products', todayRes.error);
        return emptyStats;
      }
      if (weekRes.error) {
        handleQueryError('useNovelties', 'products', weekRes.error);
        return emptyStats;
      }
      if (fifteenRes.error) {
        handleQueryError('useNovelties', 'products', fifteenRes.error);
        return emptyStats;
      }
      if (activeRes.error) {
        handleQueryError('useNovelties', 'products', activeRes.error);
        return emptyStats;
      }
      if (totalRes.error) {
        handleQueryError('useNovelties', 'products', totalRes.error);
        return emptyStats;
      }

      const arrivedToday = todayRes.count ?? 0;
      const arrivedThisWeek = weekRes.count ?? 0;
      const arrivedLast15Days = fifteenRes.count ?? 0;
      const activeCount = activeRes.count ?? 0;
      const expiringSoon = expiringSoonRes.error ? 0 : (expiringSoonRes.count ?? 0);
      const totalProducts = totalRes.count ?? 0;

      // FIX (auditoria Novidades, P1-A/P1-C): ranking de fornecedores 100%
      // server-side sobre TODO o conjunto de novidades da pipeline, paginado. Antes:
      //  (1) o card "Top Fornecedor" usava 1 SELECT sem .range() -> sujeito ao
      //      teto db-max-rows (~1000) e mudo em escala;
      //  (2) o painel "Por Fornecedor" (ExpiringNoveltiesWidget) derivava o
      //      ranking de apenas 200 itens -> contradizia o card (ex.: painel
      //      dizia "Só Marcas 54%" quando a verdade era "XBZ 58%").
      const SUP_PAGE = 1000;
      const SUP_MAX_PAGES = 25; // anti-loop: teto ~25k
      const supplierCounts = new Map<string, number>();
      {
        let supFrom = 0;
        for (let page = 0; page < SUP_MAX_PAGES; page += 1) {
          const { data: supPage, error: supPageErr } = await applyNoveltyPredicate(
            fromTable('products').select('supplier_id'),
            nowIso,
          )
            .order('id', { ascending: true })
            .range(supFrom, supFrom + SUP_PAGE - 1);
          if (supPageErr) {
            handleQueryError('useNovelties', 'products', supPageErr);
            break;
          }
          const rows = (supPage ?? []) as unknown as { supplier_id: string | null }[];
          for (const row of rows) {
            if (row.supplier_id) {
              supplierCounts.set(row.supplier_id, (supplierCounts.get(row.supplier_id) ?? 0) + 1);
            }
          }
          supFrom += rows.length;
          if (rows.length < SUP_PAGE) break; // última página
        }
      }

      const sortedSuppliers = [...supplierCounts.entries()].sort((a, b) => b[1] - a[1]);
      const topSupplierIds = sortedSuppliers.slice(0, 8).map(([id]) => id);

      const supplierNameById = new Map<string, string>();
      if (topSupplierIds.length > 0) {
        const { data: supData, error: supErr } = await fromTable('suppliers')
          .select('id, name')
          .in('id', topSupplierIds)
          .range(0, topSupplierIds.length - 1);
        if (!supErr && supData) {
          for (const sup of supData as unknown as { id: string; name: string }[]) {
            supplierNameById.set(sup.id, sup.name);
          }
        }
      }

      const supplierBreakdown: NoveltySupplierBreakdown[] = sortedSuppliers
        .slice(0, 6)
        .map(([id, count]) => ({
          id,
          name: supplierNameById.get(id) ?? '—',
          count,
          percentage: activeCount > 0 ? Math.round((count / activeCount) * 100) : 0,
        }));

      const topSupplierId: string | null =
        sortedSuppliers.length > 0 ? sortedSuppliers[0][0] : null;
      const topSupplierCount = sortedSuppliers.length > 0 ? sortedSuppliers[0][1] : 0;
      const topSupplierName: string | null = topSupplierId
        ? (supplierNameById.get(topSupplierId) ?? null)
        : null;

      return {
        totalNovelties: activeCount,
        activeNovelties: activeCount,
        expiringSoon,
        totalProducts,
        noveltyRate: totalProducts > 0 ? Math.round((activeCount / totalProducts) * 100) : 0,
        arrivedToday,
        arrivedThisWeek,
        arrivedLast15Days,
        topSupplierName,
        topSupplierCount,
        supplierBreakdown,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook para buscar novidades via interface simplificada.
 * Aplica filtros de qualidade: não stockout, com imagem, com preço.
 */
export function useNovelties(
  options: UseNoveltiesOptions & { supplierCode?: string; maxDays?: number } = {},
) {
  const { supplierCode, limit = 50, maxDays } = options;

  return useQuery({
    queryKey: ['novelties-rpc', supplierCode, limit, maxDays],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      let supplierId: string | undefined;

      if (supplierCode) {
        const { data: supData, error: supError } = await fromTable('suppliers')
          .select('id')
          .eq('code', supplierCode)
          .range(0, 0);
        if (supError) return handleQueryError('useNovelties', 'suppliers', supError);
        if (supData && supData.length > 0) {
          supplierId = (supData[0] as unknown as { id: string }).id;
        }
      }

      let query = applyNoveltyPredicate(fromTable('products').select(NOVELTY_SELECT), nowIso)
        .order('novelty_detected_at', { ascending: false })
        .order('id', { ascending: true })
        .range(0, limit - 1);

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;
      if (error) return handleQueryError('useNovelties', 'products', error);

      let novelties = ((data ?? []) as unknown as RawProduct[])
        .map(toNovelty)
        .filter((n) => n.is_active);

      // maxDays = "detectadas há no máximo N dias" (idade da novidade).
      if (maxDays) {
        novelties = novelties.filter((n) => n.days_as_novelty <= maxDays);
      }

      return novelties;
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook para contar total de novidades ativas.
 * Aplica filtros de qualidade: não stockout, com imagem, com preço.
 */
export function useNoveltyCount() {
  return useQuery<number>({
    queryKey: ['novelty-count'],
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      const { count, error } = await applyNoveltyPredicate(
        fromTable('products').select('id', { count: 'exact' }),
        nowIso,
      ).range(0, 0);
      if (error) {
        handleQueryError('useNovelties', 'products', error);
        return 0;
      }

      return count || 0;
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Verifica se um produto específico é novidade.
 * Respeita os filtros de qualidade: o produto deve estar ativo,
 * não ser stockout, ter imagem e ter preço definido.
 */
export function useIsProductNovelty(productId: string) {
  return useQuery<{ isNovelty: boolean; daysRemaining: number | null }>({
    queryKey: ['is-novelty', productId],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await applyNoveltyPredicate(
        fromTable('products').select('id, novelty_expires_at'),
        nowIso,
      )
        .eq('id', productId)
        .range(0, 0);
      if (error) {
        handleQueryError('useNovelties', 'products', error);
        return { isNovelty: false, daysRemaining: null };
      }

      const rows = (data ?? []) as unknown as { id: string; novelty_expires_at: string }[];
      if (rows.length === 0) {
        return { isNovelty: false, daysRemaining: null };
      }

      const daysRemaining = calcDaysRemaining(rows[0].novelty_expires_at);
      return {
        isNovelty: daysRemaining > 0,
        daysRemaining: daysRemaining > 0 ? daysRemaining : null,
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!productId,
  });
}

/**
 * Hook para buscar IDs de produtos que são novidades (batch checking de badges).
 * Aplica filtros de qualidade: exclui stockout, sem imagem e sem preço.
 * Alinha o badge do card com o que a pipeline DB considera novidade.
 */
export function useNoveltyProductIds() {
  return useQuery<Set<string>>({
    queryKey: ['novelty-product-ids'],
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      // BUGFIX (audit 200-commits, P1-1): substitui o cap silencioso .range(0,1999)
      // por paginacao completa. O PostgREST pode aplicar db-max-rows (~1000), entao
      // pedir 2000 numa tacada poderia truncar novidades em bursts de ingestao.
      const PAGE = 1000;
      const MAX_PAGES = 50; // guarda anti-loop: teto de 50k novidades
      const ids = new Set<string>();
      // HARDENING: avanca pelo nro real de linhas e para em pagina vazia.
      // db-max-rows medido = 1000 em prod; isto torna a paginacao robusta a
      // QUALQUER teto do servidor, sem depender do acoplamento PAGE == teto.
      let from = 0;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const { data, error } = await applyNoveltyPredicate(
          fromTable('products').select('id'),
          nowIso,
        )
          .order('id', { ascending: true }) // ordenacao estavel p/ paginacao deterministica
          .range(from, from + PAGE - 1);
        if (error) {
          handleQueryError('useNovelties', 'products', error);
          break;
        }
        const rows = (data ?? []) as unknown as { id: string }[];
        for (const r of rows) ids.add(r.id);
        from += rows.length;
        if (rows.length === 0) break; // fim dos resultados
      }

      return ids;
    },
    staleTime: 2 * 60 * 1000,
  });
}

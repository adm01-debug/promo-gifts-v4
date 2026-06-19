import { getCatalogStockStatus } from '@/lib/catalog-stock-status';
import { useQuery } from '@tanstack/react-query';
import { resolveTable, handleQueryError } from '@/lib/supabase-direct';
import { untypedFrom } from '@/lib/supabase-untyped';

const fromTable = (table: string) => untypedFrom(resolveTable(table));

const NOVELTY_WINDOW_DAYS = 30;
const NOVELTY_SELECT =
  'id, name, sku, primary_image_url, set_image_url, sale_price, category_id, supplier_id, created_at, stock_quantity, min_quantity';

/**
 * Filtros de qualidade aplicados a TODOS os hooks de novidades.
 * Garante consistência com a pipeline DB (product_novelties):
 * - is_stockout=false  → produto em stockout não é novidade
 * - sale_price > 0     → produto sem preço não aparece como novidade
 * - primary_image_url  → produto sem imagem não aparece como novidade
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const applyNoveltyQualityFilters = (query: any): any =>
  query.eq('is_stockout', false).not('primary_image_url', 'is', null).gt('sale_price', 0);

/**
 * Calcula a data de corte para novidades (últimos N dias)
 */
function getCutoffDate(days: number = NOVELTY_WINDOW_DAYS): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Calcula dias restantes como novidade
 */
function calcDaysRemaining(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  return Math.max(0, NOVELTY_WINDOW_DAYS - elapsed);
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
}

interface RawProduct {
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
            .in('id', categoryIds)
            .range(0, 499);
          if (error) return handleQueryError('useNovelties', 'categories', error);
          return data ?? [];
        })()
      : Promise.resolve([] as CategoryRecord[]),
    supplierIds.length > 0
      ? (async () => {
          const { data, error } = await fromTable('suppliers')
            .select('id, name, code')
            .in('id', supplierIds)
            .range(0, 199);
          if (error) return handleQueryError('useNovelties', 'suppliers', error);
          return data ?? [];
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
 * Converte produto cru do banco externo em NoveltyWithDetails
 */
function toNovelty(p: RawProduct): NoveltyWithDetails {
  const daysRemaining = calcDaysRemaining(p.created_at);
  const expiresAt = new Date(
    new Date(p.created_at).getTime() + NOVELTY_WINDOW_DAYS * 86400000,
  ).toISOString();
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
    detected_at: p.created_at,
    expires_at: expiresAt,
    days_remaining: daysRemaining,
    status: daysRemaining <= 0 ? 'expired' : daysRemaining <= 7 ? 'expiring_soon' : 'active',
    is_highlighted: daysRemaining >= 25,
    is_active: daysRemaining > 0,
    stock_quantity: stock,
    min_quantity: minQty,
    stock_status: stockStatus,
  };
}

export interface UseNoveltiesOptions {
  limit?: number;
  offset?: number;
  onlyHighlighted?: boolean;
}

/**
 * Hook para buscar novidades — produtos adicionados nos últimos 30 dias.
 * Aplica filtros de qualidade: não stockout, com imagem, com preço.
 */
export function useNoveltiesWithDetails(options: UseNoveltiesOptions = {}) {
  const { limit = 100, onlyHighlighted = false } = options;

  return useQuery<NoveltyWithDetails[]>({
    queryKey: ['novelties-details', limit, onlyHighlighted],
    queryFn: async () => {
      const cutoff = getCutoffDate();

      const baseQuery = applyNoveltyQualityFilters(
        fromTable('products').select(NOVELTY_SELECT).eq('is_active', true),
      );

      const { data, error } = await baseQuery
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(0, limit - 1);
      if (error) return handleQueryError('useNovelties', 'products', error);

      const records: RawProduct[] = data ?? [];

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
      const cutoff = getCutoffDate();

      const baseQuery = applyNoveltyQualityFilters(
        fromTable('products').select(NOVELTY_SELECT).eq('is_active', true),
      );

      const { data, error } = await baseQuery
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(0, 199);
      if (error) return handleQueryError('useNovelties', 'products', error);

      return ((data ?? []) as unknown as RawProduct[])
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
 * Alinha os counts do frontend com a pipeline DB (product_novelties).
 */
export function useNoveltyStats() {
  return useQuery<NoveltyStatsDisplay>({
    queryKey: ['novelty-stats'],
    queryFn: async () => {
      const now = new Date();
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
      const thirtyStart = getCutoffDate();
      const expiringSoonCutoff = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 23,
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
      };

      // Helper: query base com filtros de qualidade para HEAD counts
      const qualityBase = () =>
        applyNoveltyQualityFilters(
          fromTable('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        );

      const [todayRes, weekRes, fifteenRes, activeRes, expiringSoonRes, totalRes, supplierRes] =
        await Promise.all([
          // Chegaram hoje (com filtros de qualidade)
          qualityBase().gte('created_at', todayStart),
          // Últimos 7 dias
          qualityBase().gte('created_at', weekStart),
          // Últimos 15 dias
          qualityBase().gte('created_at', fifteenStart),
          // Novidades ativas (últimos 30 dias)
          qualityBase().gte('created_at', thirtyStart),
          // Expirando em breve
          qualityBase().gte('created_at', thirtyStart).lt('created_at', expiringSoonCutoff),
          // Total do catálogo ativo (sem filtros de qualidade — denominador real)
          fromTable('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
          // supplier_id para top fornecedor (com filtros de qualidade)
          applyNoveltyQualityFilters(
            fromTable('products').select('supplier_id').eq('is_active', true),
          ).gte('created_at', thirtyStart),
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

      const supplierRows =
        !supplierRes.error && supplierRes.data
          ? (supplierRes.data as unknown as Array<{ supplier_id: string | null }>)
          : [];

      const supplierCounts = new Map<string, number>();
      for (const row of supplierRows) {
        if (row.supplier_id) {
          supplierCounts.set(row.supplier_id, (supplierCounts.get(row.supplier_id) ?? 0) + 1);
        }
      }

      let topSupplierId: string | null = null;
      let topSupplierCount = 0;
      for (const [id, count] of supplierCounts) {
        if (count > topSupplierCount) {
          topSupplierCount = count;
          topSupplierId = id;
        }
      }

      let topSupplierName: string | null = null;
      if (topSupplierId) {
        try {
          const { data: supData, error: supError } = await fromTable('suppliers')
            .select('name')
            .eq('id', topSupplierId)
            .range(0, 0);
          if (!supError && supData?.length) {
            topSupplierName = supData[0].name ?? null;
          }
        } catch {
          /* fallback silencioso */
        }
      }

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
      const cutoff = getCutoffDate();
      let supplierId: string | undefined;

      if (supplierCode) {
        const { data: supData, error: supError } = await fromTable('suppliers')
          .select('id')
          .eq('code', supplierCode)
          .range(0, 0);
        if (supError) return handleQueryError('useNovelties', 'suppliers', supError);
        if (supData?.length) {
          supplierId = supData[0].id;
        }
      }

      let query = applyNoveltyQualityFilters(
        fromTable('products').select(NOVELTY_SELECT).eq('is_active', true),
      )
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
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

      if (maxDays) {
        novelties = novelties.filter((n) => n.days_remaining >= NOVELTY_WINDOW_DAYS - maxDays);
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
      const cutoff = getCutoffDate();

      const { count, error } = await applyNoveltyQualityFilters(
        fromTable('products').select('id', { count: 'exact' }).eq('is_active', true),
      )
        .gte('created_at', cutoff)
        .range(0, 0);
      if (error) {
        handleQueryError('useNovelties', 'products', error);
        return 0;
      }

      return count ?? 0;
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
      const { data, error } = await applyNoveltyQualityFilters(
        fromTable('products').select('id, created_at').eq('is_active', true),
      )
        .eq('id', productId)
        .range(0, 0);
      if (error) {
        handleQueryError('useNovelties', 'products', error);
        return { isNovelty: false, daysRemaining: null };
      }

      const rows = (data ?? []) as unknown as Array<{ id: string; created_at: string }>;
      if (rows.length === 0) {
        return { isNovelty: false, daysRemaining: null };
      }

      const daysRemaining = calcDaysRemaining(rows[0].created_at);
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
      const cutoff = getCutoffDate();

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
        const { data, error } = await applyNoveltyQualityFilters(
          fromTable('products').select('id').eq('is_active', true),
        )
          .gte('created_at', cutoff)
          .order('id', { ascending: true }) // ordenacao estavel p/ paginacao deterministica
          .range(from, from + PAGE - 1);
        if (error) {
          handleQueryError('useNovelties', 'products', error);
          break;
        }
        const rows = (data ?? []) as unknown as Array<{ id: string }>;
        for (const r of rows) ids.add(r.id);
        from += rows.length;
        if (rows.length === 0) break; // fim dos resultados
      }

      return ids;
    },
    staleTime: 2 * 60 * 1000,
  });
}

import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db/bridge';

const NOVELTY_WINDOW_DAYS = 30;
const NOVELTY_SELECT = 'id, name, sku, primary_image_url, sale_price, category_id, supplier_id, created_at, stock_quantity, min_quantity';

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
  sale_price: number | null;
  category_id: string | null;
  supplier_id: string | null;
  created_at: string;
  stock_quantity: number | null;
  min_quantity: number | null;
}

interface CategoryRecord { id: string; name: string; }
interface SupplierRecord { id: string; name: string; code?: string; }

/**
 * Enriquece novidades com nomes de categoria e fornecedor
 */
async function enrichNovelties(novelties: NoveltyWithDetails[]): Promise<NoveltyWithDetails[]> {
  const categoryIds = [...new Set(novelties.map(n => n.category_id).filter(Boolean))] as string[];
  const supplierIds = [...new Set(novelties.map(n => n.supplier_id).filter(Boolean))] as string[];

  const [catResult, supResult] = await Promise.all([
    categoryIds.length > 0
      ? invokeExternalDb<CategoryRecord>({
          table: 'categories',
          operation: 'select',
          select: 'id, name',
          filters: { id: `in.(${categoryIds.join(',')})` },
          limit: 500,
        })
      : { records: [] as CategoryRecord[] },
    supplierIds.length > 0
      ? invokeExternalDb<SupplierRecord>({
          table: 'suppliers',
          operation: 'select',
          select: 'id, name, code',
          filters: { id: `in.(${supplierIds.join(',')})` },
          limit: 200,
        })
      : { records: [] as SupplierRecord[] },
  ]);

  const catMap = new Map(catResult.records.map(c => [c.id, c.name]));
  const supMap = new Map(supResult.records.map(s => [s.id, { name: s.name, code: s.code }]));

  return novelties.map(n => ({
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
  const expiresAt = new Date(new Date(p.created_at).getTime() + NOVELTY_WINDOW_DAYS * 86400000).toISOString();
  const stock = p.stock_quantity ?? 0;
  const minQty = p.min_quantity ?? 10;
  const stockStatus: NoveltyWithDetails['stock_status'] = stock === 0 ? 'out-of-stock' : stock < minQty ? 'low-stock' : 'in-stock';
  
  return {
    novelty_id: p.id,
    product_id: p.id,
    product_sku: p.sku,
    product_name: p.name,
    product_description: null,
    base_price: p.sale_price,
    product_image: p.primary_image_url,
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
 * Hook para buscar novidades — produtos adicionados nos últimos 30 dias (banco externo)
 */
export function useNoveltiesWithDetails(options: UseNoveltiesOptions = {}) {
  const { limit = 100, onlyHighlighted = false } = options;

  return useQuery<NoveltyWithDetails[]>({
    queryKey: ['novelties-details', limit, onlyHighlighted],
    queryFn: async () => {
      const cutoff = getCutoffDate();
      
      const result = await invokeExternalDb<RawProduct>({
        table: 'products',
        operation: 'select',
        select: NOVELTY_SELECT,
        filters: { is_active: true, created_at: `gte.${cutoff}` },
        orderBy: { column: 'created_at', ascending: false },
        limit,
      });

      let novelties = result.records.map(toNovelty).filter(n => n.is_active);

      if (onlyHighlighted) {
        novelties = novelties.filter(n => n.is_highlighted);
      }

      // Enriquecer com nomes de categoria e fornecedor
      return enrichNovelties(novelties);
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook para buscar novidades expirando em breve (≤ maxDays restantes)
 */
export function useExpiringNovelties(maxDays: number = 7) {
  return useQuery<NoveltyWithDetails[]>({
    queryKey: ['expiring-novelties', maxDays],
    queryFn: async () => {
      // Buscar todas as novidades dos últimos 30 dias
      const cutoff = getCutoffDate();
      
      const result = await invokeExternalDb<RawProduct>({
        table: 'products',
        operation: 'select',
        select: NOVELTY_SELECT,
        filters: { is_active: true, created_at: `gte.${cutoff}` },
        orderBy: { column: 'created_at', ascending: true },
        limit: 200,
      });

      return result.records
        .map(toNovelty)
        .filter(n => n.is_active && n.days_remaining <= maxDays)
        .sort((a, b) => a.days_remaining - b.days_remaining);
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook para estatísticas de novidades
 */
export function useNoveltyStats() {
  return useQuery<NoveltyStatsDisplay>({
    queryKey: ['novelty-stats'],
    queryFn: async () => {
      const cutoff = getCutoffDate();
      
      const [noveltiesResult, totalResult] = await Promise.all([
        invokeExternalDb<RawProduct & { supplier_id: string | null }>({
          table: 'products',
          operation: 'select',
          select: 'id, created_at, supplier_id',
          filters: { is_active: true, created_at: `gte.${cutoff}` },
          limit: 500,
          countMode: 'exact',
        }),
        invokeExternalDb<{ id: string }>({
          table: 'products',
          operation: 'select',
          select: 'id',
          filters: { is_active: true },
          limit: 1,
          countMode: 'exact',
        }),
      ]);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const weekStart = todayStart - 6 * 86400000;
      const fifteenDaysStart = todayStart - 14 * 86400000;

      const novelties = noveltiesResult.records.map(p => ({
        daysRemaining: calcDaysRemaining(p.created_at),
        createdTime: new Date(p.created_at).getTime(),
        supplierId: p.supplier_id,
      }));

      const active = novelties.filter(n => n.daysRemaining > 0);
      const expiring = active.filter(n => n.daysRemaining <= 7);
      const arrivedToday = active.filter(n => n.createdTime >= todayStart).length;
      const arrivedThisWeek = active.filter(n => n.createdTime >= weekStart).length;
      const arrivedLast15Days = active.filter(n => n.createdTime >= fifteenDaysStart).length;
      const totalProducts = totalResult.count || 0;
      const activeCount = active.length;

      // Find top supplier
      const supplierCounts = new Map<string, number>();
      active.forEach(n => {
        if (n.supplierId) {
          supplierCounts.set(n.supplierId, (supplierCounts.get(n.supplierId) || 0) + 1);
        }
      });
      let topSupplierId: string | null = null;
      let topSupplierCount = 0;
      supplierCounts.forEach((count, id) => {
        if (count > topSupplierCount) {
          topSupplierCount = count;
          topSupplierId = id;
        }
      });

      // Resolve top supplier name
      let topSupplierName: string | null = null;
      if (topSupplierId) {
        try {
          const supResult = await invokeExternalDb<{ name: string }>({
            table: 'suppliers',
            operation: 'select',
            select: 'name',
            filters: { id: topSupplierId },
            limit: 1,
          });
          topSupplierName = supResult.records[0]?.name || null;
        } catch { /* fallback */ }
      }

      return {
        totalNovelties: novelties.length,
        activeNovelties: activeCount,
        expiringSoon: expiring.length,
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
 * Hook para buscar novidades via interface simplificada (compatível com NoveltiesSection)
 */
export function useNovelties(options: UseNoveltiesOptions & { supplierCode?: string; maxDays?: number } = {}) {
  const { supplierCode, limit = 50, maxDays } = options;

  return useQuery({
    queryKey: ['novelties-rpc', supplierCode, limit, maxDays],
    queryFn: async () => {
      const cutoff = getCutoffDate();
      const filters: Record<string, unknown> = { is_active: true, created_at: `gte.${cutoff}` };
      
      if (supplierCode) {
        // Precisa buscar o supplier_id pelo code
        const supplierResult = await invokeExternalDb<{ id: string }>({
          table: 'suppliers',
          operation: 'select',
          select: 'id',
          filters: { code: supplierCode },
          limit: 1,
        });
        if (supplierResult.records.length > 0) {
          filters.supplier_id = supplierResult.records[0].id;
        }
      }

      const result = await invokeExternalDb<RawProduct>({
        table: 'products',
        operation: 'select',
        select: NOVELTY_SELECT,
        filters,
        orderBy: { column: 'created_at', ascending: false },
        limit,
      });

      let novelties = result.records.map(toNovelty).filter(n => n.is_active);

      if (maxDays) {
        novelties = novelties.filter(n => n.days_remaining >= (NOVELTY_WINDOW_DAYS - maxDays));
      }

      return novelties;
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook para contar total de novidades ativas
 */
export function useNoveltyCount() {
  return useQuery<number>({
    queryKey: ['novelty-count'],
    queryFn: async () => {
      const cutoff = getCutoffDate();
      
      const result = await invokeExternalDb<{ id: string }>({
        table: 'products',
        operation: 'select',
        select: 'id',
        filters: { is_active: true, created_at: `gte.${cutoff}` },
        limit: 1,
        countMode: 'exact',
      });

      return result.count || 0;
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Verifica se um produto específico é novidade
 */
export function useIsProductNovelty(productId: string) {
  return useQuery<{ isNovelty: boolean; daysRemaining: number | null }>({
    queryKey: ['is-novelty', productId],
    queryFn: async () => {
      const result = await invokeExternalDb<RawProduct>({
        table: 'products',
        operation: 'select',
        select: 'id, created_at',
        filters: { id: productId, is_active: true },
        limit: 1,
      });

      if (!result.records.length) {
        return { isNovelty: false, daysRemaining: null };
      }

      const daysRemaining = calcDaysRemaining(result.records[0].created_at);
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
 * Hook para buscar IDs de produtos que são novidades (para batch checking)
 */
export function useNoveltyProductIds() {
  return useQuery<Set<string>>({
    queryKey: ['novelty-product-ids'],
    queryFn: async () => {
      const cutoff = getCutoffDate();
      
      const result = await invokeExternalDb<{ id: string }>({
        table: 'products',
        operation: 'select',
        select: 'id',
        filters: { is_active: true, created_at: `gte.${cutoff}` },
        limit: 500,
      });

      return new Set(result.records.map(r => r.id));
    },
    staleTime: 2 * 60 * 1000,
  });
}

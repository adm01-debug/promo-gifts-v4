import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const NOVELTY_WINDOW_DAYS = 30;
const NOVELTY_SELECT =
  'id, name, sku, primary_image_url, sale_price, category_id, supplier_id, created_at, stock_quantity, min_quantity';

/**
 * MOCK DATA para visualização quando o banco está vazio
 */
const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'Eletrônicos' },
  { id: 'cat-2', name: 'Escritório' },
  { id: 'cat-3', name: 'Acessórios' },
  { id: 'cat-4', name: 'Lifestyle' },
];

const MOCK_SUPPLIERS = [
  { id: 'sup-1', name: 'Tech Gifts S.A.', code: 'TGS' },
  { id: 'sup-2', name: 'Premium Office', code: 'POF' },
  { id: 'sup-3', name: 'Global Merch', code: 'GME' },
];

const getMockDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

const MOCK_PRODUCTS: RawProduct[] = [
  {
    id: 'mock-1',
    name: 'Smartwatch Ultra Pro X',
    sku: 'SW-001',
    primary_image_url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80',
    sale_price: 299.9,
    category_id: 'cat-1',
    supplier_id: 'sup-1',
    created_at: getMockDate(0), // Hoje
    stock_quantity: 45,
    min_quantity: 10,
  },
  {
    id: 'mock-2',
    name: 'Caderno Moleskine Executive',
    sku: 'NB-202',
    primary_image_url: 'https://images.unsplash.com/photo-1544816153-0973059446d3?w=800&q=80',
    sale_price: 89.0,
    category_id: 'cat-2',
    supplier_id: 'sup-2',
    created_at: getMockDate(2), // 2 dias atrás (Últimos 7 dias)
    stock_quantity: 5,
    min_quantity: 15,
  },
  {
    id: 'mock-3',
    name: 'Garrafa Térmica Titanium',
    sku: 'BT-500',
    primary_image_url: 'https://images.unsplash.com/photo-1602143394807-a2536fe0589a?w=800&q=80',
    sale_price: 124.5,
    category_id: 'cat-4',
    supplier_id: 'sup-3',
    created_at: getMockDate(5), // 5 dias atrás (Últimos 7 dias)
    stock_quantity: 120,
    min_quantity: 20,
  },
  {
    id: 'mock-4',
    name: 'Fone Bluetooth Noise Cancelling',
    sku: 'HP-99',
    primary_image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    sale_price: 450.0,
    category_id: 'cat-1',
    supplier_id: 'sup-1',
    created_at: getMockDate(12), // 12 dias atrás (Últimos 15 dias)
    stock_quantity: 0,
    min_quantity: 5,
  },
  {
    id: 'mock-5',
    name: 'Kit Canetas Premium Metal',
    sku: 'PN-05',
    primary_image_url: 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=800&q=80',
    sale_price: 45.0,
    category_id: 'cat-2',
    supplier_id: 'sup-2',
    created_at: getMockDate(25), // 25 dias atrás (Expira logo)
    stock_quantity: 300,
    min_quantity: 50,
  },
];

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

  // Fallback para mock se os IDs forem do mock
  const isMock = novelties.some((n) => n.product_id.startsWith('mock-'));

  const [catResult, supResult] = await Promise.all([
    !isMock && categoryIds.length > 0
      ? supabase.from('categories').select('id, name').in('id', categoryIds).limit(500).then(r => ({ records: r.data || [], error: r.error }))
      : Promise.resolve({ records: isMock ? MOCK_CATEGORIES : [], error: null }),
    !isMock && supplierIds.length > 0
      ? supabase.from('v_suppliers_public').select('id, name, code').in('id', supplierIds).limit(200).then(r => ({ records: r.data || [], error: r.error }))
      : Promise.resolve({ records: isMock ? MOCK_SUPPLIERS : [], error: null }),
  ]);

  const catMap = new Map(catResult.records.map((c) => [c.id, c.name]));
  const supMap = new Map(supResult.records.map((s) => [s.id, { name: s.name, code: s.code }]));

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
  const stockStatus: NoveltyWithDetails['stock_status'] =
    stock === 0 ? 'out-of-stock' : stock < minQty ? 'low-stock' : 'in-stock';

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

      const { data, error } = await supabase
        .from('v_products_public')
        .select(NOVELTY_SELECT)
        .eq('is_active', true)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .range(0, limit - 1);

      if (error) {
        const isGone = error.message?.includes('410') || error.message?.includes('Gone');
        if (isGone) {
          const { reportSilentEmpty } = await import('@/lib/external-db/silent-empty-report');
          reportSilentEmpty({ 
            reason: 'gone_410', 
            table: 'v_products_public', 
            operation: 'select', 
            message: error.message 
          });
          logger.warn('Bridge deprecated (410) for products novelties');
          return [];
        }
        throw error;
      }


      let records = (data as unknown as RawProduct[]) || [];

      // Fallback para MOCK se o banco estiver vazio
      if (records.length === 0) {
        records = MOCK_PRODUCTS;
      }

      let novelties = records.map(toNovelty).filter((n) => n.is_active);

      if (onlyHighlighted) {
        novelties = novelties.filter((n) => n.is_highlighted);
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

      const { data, error } = await supabase
        .from('v_products_public')
        .select(NOVELTY_SELECT)
        .eq('is_active', true)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })
        .range(0, 199);

      if (error) {
        if (error.message?.includes('410') || error.message?.includes('Gone')) {
          return [];
        }
        throw error;
      }

      return ((data as unknown as RawProduct[]) || [])
        .map(toNovelty)
        .filter((n) => n.is_active && n.days_remaining <= maxDays)
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
        supabase
          .from('v_products_public')
          .select('id, created_at, supplier_id', { count: 'exact' })
          .eq('is_active', true)
          .gte('created_at', cutoff)
          .range(0, 499),
        supabase
          .from('v_products_public')
          .select('id', { count: 'exact' })
          .eq('is_active', true)
          .limit(1),
      ]);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const weekStart = todayStart - 6 * 86400000;
      const fifteenDaysStart = todayStart - 14 * 86400000;

      let records = (noveltiesResult.data as unknown as RawProduct[]) || [];
      let totalProducts = totalResult.count || 0;

      // Fallback para MOCK se o banco estiver vazio
      if (records.length === 0 && totalProducts === 0) {
        records = MOCK_PRODUCTS;
        totalProducts = MOCK_PRODUCTS.length + 50; // Simula uma taxa de novidade realista
      }

      const novelties = records.map((p) => ({
        daysRemaining: calcDaysRemaining(p.created_at),
        createdTime: new Date(p.created_at).getTime(),
        supplierId: p.supplier_id,
      }));

      const active = novelties.filter((n) => n.daysRemaining > 0);
      const expiring = active.filter((n) => n.daysRemaining <= 7);
      const arrivedToday = active.filter((n) => n.createdTime >= todayStart).length;
      const arrivedThisWeek = active.filter((n) => n.createdTime >= weekStart).length;
      const arrivedLast15Days = active.filter((n) => n.createdTime >= fifteenDaysStart).length;
      const activeCount = active.length;

      // Find top supplier
      const supplierCounts = new Map<string, number>();
      active.forEach((n) => {
        if (n.supplierId) {
          supplierCounts.set(n.supplierId, (supplierCounts.get(n.supplierId) || 0) + 1);
        }
      });
      let topSupplierId: string | null = null;
      let topSupplierCount = 0;
      // for...of (não é closure) → o control-flow do TS rastreia a atribuição e
      // mantém topSupplierId como string | null após o loop. Com forEach o TS5.4
      // re-estreita para null (closure invisível ao analisador) → TS2339.
      for (const [id, count] of supplierCounts) {
        if (count > topSupplierCount) {
          topSupplierCount = count;
          topSupplierId = id;
        }
      }

      // Resolve top supplier name
      let topSupplierName: string | null = null;
      if (topSupplierId) {
        if (topSupplierId.startsWith('sup-')) {
          topSupplierName = MOCK_SUPPLIERS.find((s) => s.id === topSupplierId)?.name || null;
        } else {
          try {
            const supRes = await supabase
              .from('v_suppliers_public')
              .select('name')
              .eq('id', topSupplierId)
              .limit(1);
            topSupplierName = supRes.data?.[0]?.name || null;
          } catch {
            /* fallback */
          }
        }
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
export function useNovelties(
  options: UseNoveltiesOptions & { supplierCode?: string; maxDays?: number } = {},
) {
  const { supplierCode, limit = 50, maxDays } = options;

  return useQuery({
    queryKey: ['novelties-rpc', supplierCode, limit, maxDays],
    queryFn: async () => {
      const cutoff = getCutoffDate();
      let query = supabase
        .from('v_products_public')
        .select(NOVELTY_SELECT)
        .eq('is_active', true)
        .gte('created_at', cutoff);

      if (supplierCode) {
        // Precisa buscar o supplier_id pelo code
        const supplierResult = await supabase
          .from('v_suppliers_public')
          .select('id')
          .eq('code', supplierCode)
          .limit(1);
        if (supplierResult.data?.length) {
          query = query.eq('supplier_id', supplierResult.data[0].id);
        }
      }

      query = query
        .order('created_at', { ascending: false })
        .range(0, limit - 1);
      
      const { data, error } = await query;

      if (error) {
        if (error.message?.includes('410') || error.message?.includes('Gone')) return [];
        throw error;
      }

      let novelties = ((data as unknown as RawProduct[]) || []).map(toNovelty).filter((n) => n.is_active);

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
 * Hook para contar total de novidades ativas
 */
export function useNoveltyCount() {
  return useQuery<number>({
    queryKey: ['novelty-count'],
    queryFn: async () => {
      const cutoff = getCutoffDate();

      const result = await dbInvoke<{ id: string }>({
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
      const result = await dbInvoke<RawProduct>({
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

      const result = await dbInvoke<{ id: string }>({
        table: 'products',
        operation: 'select',
        select: 'id',
        filters: { is_active: true, created_at: `gte.${cutoff}` },
        limit: 500,
      });

      return new Set(result.records.map((r) => r.id));
    },
    staleTime: 2 * 60 * 1000,
  });
}

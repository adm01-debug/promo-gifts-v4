/**
 * useCommercialIntelligence — Hook agregador para o módulo de Inteligência Comercial
 * Helpers extraídos para intelligence/intelligenceHelpers.ts
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentOrgId } from '@/hooks/common';
import { useSalesScope } from '@/lib/auth/visibility-scope';
import { logger } from '@/lib/logger';
import {
  getSinceDate,
  aggregateSegments,
  aggregateClients,
} from '@/hooks/intelligence/intelligenceHelpers';

// Re-export types
export type { FilterParams } from '@/hooks/intelligence/intelligenceHelpers';

export interface IntelligenceKPI {
  totalQuotes: number;
  totalOrders: number;
  conversionRate: number;
  totalRevenue: number;
  averageTicket: number;
  quotesThisMonth: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
}

export interface TrendingProduct {
  productId: string;
  productSku: string | null;
  productName: string;
  productImage: string | null;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
  quoteCount: number;
  conversionRate: number;
  trend: 'up' | 'down' | 'stable';
}

export interface SegmentData {
  segment: string;
  orderCount: number;
  revenue: number;
  averageTicket: number;
}

export interface OpportunityProduct {
  productId: string;
  productSku: string | null;
  productName: string;
  productImage: string | null;
  quoteCount: number;
  orderCount: number;
  conversionRate: number;
  opportunityScore: number;
  reason: string;
}

export interface CategoryRankingItem {
  categoryId: string;
  categoryName: string;
  internalRevenue: number;
  internalQty: number;
  internalOrders: number;
  marketDepleted: number;
  totalScore: number;
}

// ============================================
// useFilteredProductIds
// ============================================
function useFilteredProductIds(
  categoryId?: string | null,
  supplierId?: string | null,
  productId?: string | null,
) {
  return useQuery({
    queryKey: ['intelligence-product-ids', categoryId, supplierId, productId],
    queryFn: async (): Promise<Set<string> | null> => {
      if (productId) return new Set([productId]);
      if (!categoryId && !supplierId) return null;
      const { fetchPromobrindProducts } = await import('@/lib/external-db');
      const filters: Record<string, unknown> = {};
      if (categoryId) filters.category_id = categoryId;
      if (supplierId) filters.supplier_id = supplierId;
      const products = await fetchPromobrindProducts({ limit: 5000, filters });
      return new Set(products.map((p) => p.id));
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!(categoryId || supplierId || productId),
  });
}

// ============================================
// KPIs
// ============================================
export function useCommercialKPIs(
  days = 30,
  categoryId?: string | null,
  supplierId?: string | null,
  productId?: string | null,
) {
  const { user } = useAuth();
  const orgId = useCurrentOrgId();
  const scope = useSalesScope();
  const since = getSinceDate(days);
  const { data: productIds } = useFilteredProductIds(categoryId, supplierId, productId);
  const hasFilter = !!(categoryId || supplierId || productId);

  return useQuery({
    queryKey: [
      'commercial-intelligence-kpis',
      user?.id,
      orgId,
      scope,
      days,
      categoryId,
      supplierId,
      productId,
      productIds ? Array.from(productIds).length : null,
    ],
    queryFn: async (): Promise<IntelligenceKPI> => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      if (hasFilter && productIds) {
        const pids = Array.from(productIds);
        if (!pids.length)
          return {
            totalQuotes: 0,
            totalOrders: 0,
            conversionRate: 0,
            totalRevenue: 0,
            averageTicket: 0,
            quotesThisMonth: 0,
            ordersThisMonth: 0,
            revenueThisMonth: 0,
          };

        const [
          { data: quoteItems },
          { data: orderItems },
          { data: orderItemsMonth },
          { data: quoteItemsMonth },
        ] = await Promise.all([
          supabase
            .from('quote_items')
            .select('quote_id, product_id')
            .gte('created_at', since)
            .in('product_id', pids.slice(0, 200)),
          supabase
            .from('order_items')
            .select('order_id, product_id, quantity, unit_price')
            .gte('created_at', since)
            .in('product_id', pids.slice(0, 200)),
          supabase
            .from('order_items')
            .select('order_id, product_id, quantity, unit_price')
            .gte('created_at', startOfMonth)
            .in('product_id', pids.slice(0, 200)),
          supabase
            .from('quote_items')
            .select('quote_id, product_id')
            .gte('created_at', startOfMonth)
            .in('product_id', pids.slice(0, 200)),
        ]);

        const uqQuotes = new Set((quoteItems || []).map((qi) => qi.quote_id));
        const uqOrders = new Set((orderItems || []).map((oi) => oi.order_id));
        const totalRevenue = (orderItems || []).reduce(
          (s, i) => s + (i.quantity ?? 0) * (i.unit_price ?? 0),
          0,
        );
        const revenueMonth = (orderItemsMonth || []).reduce(
          (s, i) => s + (i.quantity ?? 0) * (i.unit_price ?? 0),
          0,
        );

        return {
          totalQuotes: uqQuotes.size,
          totalOrders: uqOrders.size,
          conversionRate: uqQuotes.size > 0 ? Math.round((uqOrders.size / uqQuotes.size) * 100) : 0,
          totalRevenue,
          averageTicket: uqOrders.size > 0 ? totalRevenue / uqOrders.size : 0,
          quotesThisMonth: new Set((quoteItemsMonth || []).map((qi) => qi.quote_id)).size,
          ordersThisMonth: new Set((orderItemsMonth || []).map((oi) => oi.order_id)).size,
          revenueThisMonth: revenueMonth,
        };
      }

      let q1 = supabase
        // rls-allow: respeita can_view_all_sales server-side
        .from('quotes')
        .select('id, total, status, created_at')
        .gte('created_at', since);
      let o1 = supabase
        // rls-allow: respeita can_view_all_sales server-side
        .from('orders')
        .select('id, total, status, created_at')
        .gte('created_at', since);
      // rls-allow: respeita can_view_all_sales server-side
      let q2 = supabase.from('quotes').select('id, total').gte('created_at', startOfMonth);
      // rls-allow: respeita can_view_all_sales server-side
      let o2 = supabase.from('orders').select('id, total').gte('created_at', startOfMonth);

      if (orgId) {
        q1 = q1.eq('organization_id', orgId);
        o1 = o1.eq('organization_id', orgId);
        q2 = q2.eq('organization_id', orgId);
        o2 = o2.eq('organization_id', orgId);
      }

      // REMOVIDO: applySellerScope.
      // Agora o BI mostra dados agregados de mercado (conforme can_view_all_sales() atualizado no banco).
      // O escopo individual do vendedor é mantido para fins de RLS granular, mas o BI
      // deliberadamente consome a visão macro.

      const [qr, or, qmr, omr] = await Promise.all([q1, o1, q2, o2]);
      const quotes = qr.data || [];
      const orders = or.data || [];
      const totalRevenue = orders.reduce((s, o) => s + (o.total ?? 0), 0);

      return {
        totalQuotes: quotes.length,
        totalOrders: orders.length,
        conversionRate: quotes.length > 0 ? Math.round((orders.length / quotes.length) * 100) : 0,
        totalRevenue,
        averageTicket: orders.length > 0 ? totalRevenue / orders.length : 0,
        quotesThisMonth: (qmr.data || []).length,
        ordersThisMonth: (omr.data || []).length,
        revenueThisMonth: (omr.data || []).reduce((s, o) => s + (o.total ?? 0), 0),
      };
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user && (!hasFilter || productIds !== undefined),
  });
}

// ============================================
// Trending Products
// ============================================
export function useTrendingProducts(
  days = 30,
  categoryId?: string | null,
  supplierId?: string | null,
  productId?: string | null,
  limit = 10,
  searchTerm?: string | null,
) {
  const { user } = useAuth();
  const since = getSinceDate(days);
  const { data: productIds } = useFilteredProductIds(categoryId, supplierId, productId);
  const hasFilter = !!(categoryId || supplierId || productId);

  return useQuery({
    queryKey: [
      'commercial-trending-products',
      user?.id,
      days,
      categoryId,
      supplierId,
      productId,
      limit,
      searchTerm,
    ],
    queryFn: async (): Promise<TrendingProduct[]> => {
      const pids = productIds ? Array.from(productIds).slice(0, 200) : undefined;
      const [{ data: orderItems }, { data: quoteItems }] = await Promise.all([
        pids
          ? supabase
              .from('order_items')
              .select(
                'product_id, product_sku, product_name, product_image_url, quantity, unit_price, order_id, created_at',
              )
              .gte('created_at', since)
              .in('product_id', pids)
          : supabase
              .from('order_items')
              .select(
                'product_id, product_sku, product_name, product_image_url, quantity, unit_price, order_id, created_at',
              )
              .gte('created_at', since),
        pids
          ? supabase
              .from('quote_items')
              .select(
                'product_id, product_sku, product_name, product_image_url, quantity, unit_price, created_at',
              )
              .gte('created_at', since)
              .in('product_id', pids)
          : supabase
              .from('quote_items')
              .select(
                'product_id, product_sku, product_name, product_image_url, quantity, unit_price, created_at',
              )
              .gte('created_at', since),
      ]);

      if (!orderItems?.length) return [];
      const productMap = new Map<string, TrendingProduct>();
      orderItems.forEach((item) => {
        const key = item.product_sku || item.product_id || item.product_name;
        if (!key) return;
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          if (
            !(item.product_name || '').toLowerCase().includes(q) &&
            !(item.product_sku || '').toLowerCase().includes(q)
          )
            return;
        }
        const existing = productMap.get(key) || {
          productId: item.product_id || '',
          productSku: item.product_sku,
          productName: item.product_name || 'Produto',
          productImage: item.product_image_url,
          orderCount: 0,
          totalQuantity: 0,
          totalRevenue: 0,
          quoteCount: 0,
          conversionRate: 0,
          trend: 'stable' as const,
        };
        existing.orderCount += 1;
        existing.totalQuantity += item.quantity ?? 0;
        existing.totalRevenue += (item.quantity ?? 0) * (item.unit_price ?? 0);
        productMap.set(key, existing);
      });
      quoteItems?.forEach((item) => {
        const key = item.product_sku || item.product_id || item.product_name;
        const product = key ? productMap.get(key) : undefined;
        if (product) product.quoteCount += 1;
      });

      return Array.from(productMap.values())
        .map((p) => ({
          ...p,
          conversionRate: p.quoteCount > 0 ? Math.round((p.orderCount / p.quoteCount) * 100) : 100,
          trend: (p.totalRevenue > 1000 ? 'up' : p.totalRevenue > 200 ? 'stable' : 'down') as
            | 'up'
            | 'down'
            | 'stable',
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user && (!hasFilter || productIds !== undefined),
  });
}

// ============================================
// Segments
// ============================================
export function useSegmentAnalysis(
  days = 30,
  categoryId?: string | null,
  supplierId?: string | null,
  productId?: string | null,
) {
  const { user } = useAuth();
  const since = getSinceDate(days);
  const { data: productIds } = useFilteredProductIds(categoryId, supplierId, productId);
  const hasFilter = !!(categoryId || supplierId || productId);

  return useQuery({
    queryKey: ['commercial-segments', user?.id, days, categoryId, supplierId],
    queryFn: async (): Promise<SegmentData[]> => {
      if (hasFilter && productIds) {
        const pids = Array.from(productIds).slice(0, 200);
        if (!pids.length) return [];
        const { data: oi } = await supabase
          .from('order_items')
          .select('order_id')
          .gte('created_at', since)
          .in('product_id', pids);
        const orderIds = [
          ...new Set((oi || []).map((o) => o.order_id).filter(Boolean)),
        ] as string[];
        if (!orderIds.length) return [];
        const { data: orders } = await supabase
          // rls-allow: respeita can_view_all_sales server-side
          .from('orders')
          .select('id, client_company, total')
          .in('id', orderIds.slice(0, 200));
        return aggregateSegments(orders || []);
      }
      const { data: orders } = await supabase
        // rls-allow: respeita can_view_all_sales server-side
        .from('orders')
        .select('client_company, total')
        .gte('created_at', since);
      return aggregateSegments(orders || []);
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user && (!hasFilter || productIds !== undefined),
  });
}

// ============================================
// Opportunities
// ============================================
export function useOpportunities(
  days = 30,
  categoryId?: string | null,
  supplierId?: string | null,
  productId?: string | null,
) {
  const { user } = useAuth();
  const since = getSinceDate(days);
  const { data: productIds } = useFilteredProductIds(categoryId, supplierId, productId);
  const hasFilter = !!(categoryId || supplierId || productId);

  return useQuery({
    queryKey: ['commercial-opportunities', user?.id, days, categoryId, supplierId],
    queryFn: async (): Promise<OpportunityProduct[]> => {
      const pids = productIds ? Array.from(productIds).slice(0, 200) : undefined;
      const [{ data: quoteItems }, { data: orderItems }] = await Promise.all([
        pids
          ? supabase
              .from('quote_items')
              .select(
                'product_id, product_sku, product_name, product_image_url, quantity, created_at',
              )
              .gte('created_at', since)
              .in('product_id', pids)
          : supabase
              .from('quote_items')
              .select(
                'product_id, product_sku, product_name, product_image_url, quantity, created_at',
              )
              .gte('created_at', since),
        pids
          ? supabase
              .from('order_items')
              .select('product_id, product_sku, product_name, created_at')
              .gte('created_at', since)
              .in('product_id', pids)
          : supabase
              .from('order_items')
              .select('product_id, product_sku, product_name, created_at')
              .gte('created_at', since),
      ]);
      if (!quoteItems?.length) return [];

      const quoteMap = new Map<
        string,
        { count: number; name: string; sku: string | null; image: string | null; id: string }
      >();
      quoteItems.forEach((item) => {
        const key = item.product_sku || item.product_id || '';
        if (!key) return;
        const e = quoteMap.get(key) || {
          count: 0,
          name: item.product_name || '',
          sku: item.product_sku,
          image: item.product_image_url,
          id: item.product_id || '',
        };
        e.count += 1;
        quoteMap.set(key, e);
      });

      const orderCountMap = new Map<string, number>();
      orderItems?.forEach((item) => {
        const key = item.product_sku || item.product_id || '';
        if (key) orderCountMap.set(key, (orderCountMap.get(key) || 0) + 1);
      });

      const opportunities: OpportunityProduct[] = [];
      quoteMap.forEach((data, key) => {
        const oc = orderCountMap.get(key) || 0;
        const cr = data.count > 0 ? Math.round((oc / data.count) * 100) : 0;
        const score = Math.max(0, 100 - cr) * Math.min(data.count / 3, 1);
        if (data.count >= 2 && cr < 60) {
          opportunities.push({
            productId: data.id,
            productSku: data.sku,
            productName: data.name,
            productImage: data.image,
            quoteCount: data.count,
            orderCount: oc,
            conversionRate: cr,
            opportunityScore: score,
            reason:
              cr === 0
                ? 'Cotado mas nunca vendido'
                : cr < 20
                  ? 'Conversão muito baixa'
                  : 'Conversão abaixo da média',
          });
        }
      });
      return opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 10);
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user && (!hasFilter || productIds !== undefined),
  });
}

// ============================================
// Top Clients
// ============================================
export function useTopClients(
  days = 30,
  categoryId?: string | null,
  supplierId?: string | null,
  productId?: string | null,
) {
  const { user } = useAuth();
  const since = getSinceDate(days);
  const { data: productIds } = useFilteredProductIds(categoryId, supplierId, productId);
  const hasFilter = !!(categoryId || supplierId || productId);

  return useQuery({
    queryKey: ['commercial-top-clients', user?.id, days, categoryId, supplierId],
    queryFn: async () => {
      if (hasFilter && productIds) {
        const pids = Array.from(productIds).slice(0, 200);
        if (!pids.length) return [];
        const { data: oi } = await supabase
          .from('order_items')
          .select('order_id, quantity, unit_price')
          .gte('created_at', since)
          .in('product_id', pids);
        const orderIds = [
          ...new Set((oi || []).map((o) => o.order_id).filter(Boolean)),
        ] as string[];
        if (!orderIds.length) return [];
        const { data: orders } = await supabase
          // rls-allow: respeita can_view_all_sales server-side
          .from('orders')
          .select('id, client_name, client_company, total')
          .in('id', orderIds.slice(0, 200));
        return aggregateClients(orders || []);
      }
      const { data: orders } = await supabase
        // rls-allow: respeita can_view_all_sales server-side
        .from('orders')
        .select('client_name, client_company, total')
        .gte('created_at', since);
      return aggregateClients(orders || []);
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user && (!hasFilter || productIds !== undefined),
  });
}

// ============================================
// Category Ranking
// ============================================
export function useCategoryRanking(
  days = 30,
  categoryId?: string | null,
  supplierId?: string | null,
  productId?: string | null,
) {
  const { user } = useAuth();
  const since = getSinceDate(days);
  const { data: productIds } = useFilteredProductIds(categoryId, supplierId, productId);
  const hasFilter = !!(categoryId || supplierId || productId);

  return useQuery({
    queryKey: ['commercial-category-ranking', user?.id, days, categoryId, supplierId, productId],
    queryFn: async (): Promise<CategoryRankingItem[]> => {
      const pids = productIds ? Array.from(productIds).slice(0, 200) : undefined;
      const { data: orderItems } = pids
        ? await supabase
            .from('order_items')
            .select('product_id, quantity, unit_price')
            .gte('created_at', since)
            .in('product_id', pids)
        : await supabase
            .from('order_items')
            .select('product_id, quantity, unit_price')
            .gte('created_at', since);

      const { fetchPromobrindProducts } = await import('@/lib/external-db');
      const products = await fetchPromobrindProducts({ limit: 5000 });
      const productCategoryMap = new Map<string, { catId: string; catName: string }>();
      products.forEach((p) => {
        const catId = p.category_id || p.main_category_id || '';
        const catName = p.category_name || catId || 'Sem categoria';
        if (catId) productCategoryMap.set(p.id, { catId, catName });
      });

      const categoryMap = new Map<string, CategoryRankingItem>();
      (orderItems || []).forEach((item) => {
        const cat = productCategoryMap.get(item.product_id || '');
        if (!cat) return;
        const e = categoryMap.get(cat.catId) || {
          categoryId: cat.catId,
          categoryName: cat.catName,
          internalRevenue: 0,
          internalQty: 0,
          internalOrders: 0,
          marketDepleted: 0,
          totalScore: 0,
        };
        e.internalRevenue += (item.quantity ?? 0) * (item.unit_price ?? 0);
        e.internalQty += item.quantity ?? 0;
        e.internalOrders += 1;
        categoryMap.set(cat.catId, e);
      });

      try {
        const { dbInvoke } = await import('@/lib/db/postgrest');
        const sinceDate = since.split('T')[0];
        const result = await dbInvoke<{ product_id: string; units_depleted: number }>({
          table: 'stock_daily_summary',
          operation: 'select',
          select: 'product_id,units_depleted',
          filters: { summary_date: { op: 'gte', value: sinceDate } }, // FIX: objeto -> .gte() (era string -> .eq() -> 400)
          limit: 5000,
        });
        (result?.records ?? []).forEach((snap) => {
          const cat = productCategoryMap.get(snap.product_id);
          if (!cat) return;
          const e = categoryMap.get(cat.catId) || {
            categoryId: cat.catId,
            categoryName: cat.catName,
            internalRevenue: 0,
            internalQty: 0,
            internalOrders: 0,
            marketDepleted: 0,
            totalScore: 0,
          };
          e.marketDepleted += snap.units_depleted ?? 0;
          categoryMap.set(cat.catId, e);
        });
      } catch (e) {
        logger.warn('Market data unavailable for category ranking:', e);
      }

      const items = Array.from(categoryMap.values());
      const maxR = Math.max(1, ...items.map((i) => i.internalRevenue));
      const maxD = Math.max(1, ...items.map((i) => i.marketDepleted));
      items.forEach((i) => {
        i.totalScore = (i.internalRevenue / maxR) * 60 + (i.marketDepleted / maxD) * 40;
      });
      return items.sort((a, b) => b.totalScore - a.totalScore).slice(0, 15);
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user && (!hasFilter || productIds !== undefined),
  });
}

// ============================================
// Supplier Sales
// ============================================
export function useSupplierSales(
  days = 30,
  categoryId?: string | null,
  supplierId?: string | null,
  productId?: string | null,
) {
  const { user } = useAuth();
  const since = getSinceDate(days);
  const { data: productIds } = useFilteredProductIds(categoryId, supplierId, productId);
  const hasFilter = !!(categoryId || supplierId || productId);

  return useQuery({
    queryKey: ['commercial-supplier-sales', user?.id, days, categoryId, supplierId],
    queryFn: async () => {
      const pids = productIds ? Array.from(productIds).slice(0, 200) : undefined;
      const { data: orderItems } = pids
        ? await supabase
            .from('order_items')
            .select('product_id, product_name, quantity, unit_price')
            .gte('created_at', since)
            .in('product_id', pids)
        : await supabase
            .from('order_items')
            .select('product_id, product_name, quantity, unit_price')
            .gte('created_at', since);
      if (!orderItems?.length) return [];

      const { fetchPromobrindProducts } = await import('@/lib/external-db');
      const products = await fetchPromobrindProducts({ limit: 5000 });
      const productSupplierMap = new Map<string, string>();
      products.forEach((p) => {
        productSupplierMap.set(p.id, p.supplier_reference || 'Sem fornecedor');
      });

      const supplierMap = new Map<
        string,
        { orderCount: number; revenue: number; products: Set<string> }
      >();
      orderItems.forEach((item) => {
        const supplier = productSupplierMap.get(item.product_id || '') || 'Sem fornecedor';
        const e = supplierMap.get(supplier) || {
          orderCount: 0,
          revenue: 0,
          products: new Set<string>(),
        };
        e.orderCount += 1;
        e.revenue += (item.quantity ?? 0) * (item.unit_price ?? 0);
        if (item.product_id) e.products.add(item.product_id);
        supplierMap.set(supplier, e);
      });

      return Array.from(supplierMap.entries())
        .map(([supplier, data]) => ({
          supplierName: supplier,
          orderCount: data.orderCount,
          revenue: data.revenue,
          productCount: data.products.size,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user && (!hasFilter || productIds !== undefined),
  });
}

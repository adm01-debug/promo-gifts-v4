/**
 * Hook para histórico de vendas internas (orçamentos + pedidos) por produto.
 * Consome: quote_items + quotes, order_items + orders do banco local.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ---------- Types ----------

export interface DailySalesPoint {
  date: string;
  quotedQty: number;
  orderedQty: number;
  quotedValue: number;
  orderedValue: number;
  quoteCount: number;
  orderCount: number;
}

export interface SellerRanking {
  sellerId: string;
  sellerName: string;
  totalQty: number;
  totalValue: number;
  quoteCount: number;
  orderCount: number;
}

export interface SalesKpis {
  totalQuotedQty: number;
  totalOrderedQty: number;
  totalQuotedValue: number;
  totalOrderedValue: number;
  conversionRate: number; // orders / quotes %
  uniqueSellers: number;
  avgOrderValue: number;
  topSellers: SellerRanking[];
}

// ---------- Hook ----------

export function useSalesHistory(productId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['sales-history', productId, days],
    queryFn: async (): Promise<{ daily: DailySalesPoint[]; kpis: SalesKpis }> => {
      if (!productId) return { daily: [], kpis: emptyKpis() };

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString();

      // Both fetches are independent — run in parallel
      const [{ data: quoteItems }, { data: orderItems }] = await Promise.all([
        supabase
          .from('quote_items')
          .select('quantity, unit_price, subtotal, created_at, quote_id')
          .eq('product_id', productId)
          .gte('created_at', cutoffStr)
          .order('created_at', { ascending: true })
          .limit(5000),
        supabase
          .from('order_items')
          .select('quantity, unit_price, created_at, order_id')
          .eq('product_id', productId)
          .gte('created_at', cutoffStr)
          .order('created_at', { ascending: true })
          .limit(5000),
      ]);

      // Fetch related quotes for seller info
      const quoteIds = [...new Set((quoteItems ?? []).map((q) => q.quote_id))];
      const orderIds = [...new Set((orderItems ?? []).map((o) => o.order_id))];

      const quotesMap: Record<string, { seller_id: string; status: string }> = {};
      const ordersMap: Record<string, { seller_id: string; status: string }> = {};

      // G15 fix: only count quotes with relevant statuses (not drafts)
      // Both queries are independent — run in parallel
      const [quotesData, ordersData] = await Promise.all([
        quoteIds.length > 0
          ? supabase
              // rls-allow: applySellerScope aplicado conforme escopo do usuário
              .from('quotes')
              .select('id, seller_id, status')
              .in('id', quoteIds)
              .in('status', ['sent', 'approved', 'rejected', 'expired', 'converted'])
              .then((r) => r.data)
          : Promise.resolve(null),
        orderIds.length > 0
          ? supabase
              // rls-allow: applySellerScope aplicado conforme escopo do usuário
              .from('orders')
              .select('id, seller_id, status')
              .in('id', orderIds.filter(Boolean) as string[])
              .then((r) => r.data)
          : Promise.resolve(null),
      ]);
      for (const q of quotesData ?? []) {
        quotesMap[q.id] = { seller_id: q.seller_id ?? '', status: q.status ?? '' };
      }
      for (const o of ordersData ?? []) {
        ordersMap[o.id] = { seller_id: o.seller_id ?? '', status: o.status ?? '' };
      }

      // Fetch seller names
      const allSellerIds = [
        ...new Set([
          ...Object.values(quotesMap).map((q) => q.seller_id),
          ...Object.values(ordersMap).map((o) => o.seller_id),
        ]),
      ];
      const sellerNames: Record<string, string> = {};
      if (allSellerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', allSellerIds);
        for (const p of profiles ?? []) {
          if (p.user_id) sellerNames[p.user_id] = p.full_name || 'Vendedor';
        }
      }

      // Aggregate daily
      const dailyMap = new Map<string, DailySalesPoint>();

      // #7 fix: guard against null created_at before substring
      for (const qi of quoteItems ?? []) {
        if (!qi.created_at) continue;
        const date = qi.created_at.substring(0, 10);
        const entry = dailyMap.get(date) || newDailyPoint(date);
        entry.quotedQty += qi.quantity || 0;
        entry.quotedValue += qi.subtotal ?? (qi.quantity ?? 0) * (qi.unit_price ?? 0);
        entry.quoteCount += 1;
        dailyMap.set(date, entry);
      }

      for (const oi of orderItems ?? []) {
        if (!oi.created_at) continue;
        const date = oi.created_at.substring(0, 10);
        const entry = dailyMap.get(date) || newDailyPoint(date);
        entry.orderedQty += oi.quantity || 0;
        entry.orderedValue += (oi.quantity || 0) * (oi.unit_price || 0);
        entry.orderCount += 1;
        dailyMap.set(date, entry);
      }

      const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Aggregate sellers
      const sellerMap = new Map<string, SellerRanking>();

      for (const qi of quoteItems ?? []) {
        const sellerId = quotesMap[qi.quote_id]?.seller_id;
        if (!sellerId) continue;
        const s = sellerMap.get(sellerId) || {
          sellerId,
          sellerName: sellerNames[sellerId] || 'Vendedor',
          totalQty: 0,
          totalValue: 0,
          quoteCount: 0,
          orderCount: 0,
        };
        s.totalQty += qi.quantity || 0;
        s.totalValue += qi.subtotal ?? (qi.quantity ?? 0) * (qi.unit_price ?? 0);
        s.quoteCount += 1;
        sellerMap.set(sellerId, s);
      }

      for (const oi of orderItems ?? []) {
        const sellerId = ordersMap[oi.order_id ?? '']?.seller_id;
        if (!sellerId) continue;
        const s = sellerMap.get(sellerId) || {
          sellerId,
          sellerName: sellerNames[sellerId] || 'Vendedor',
          totalQty: 0,
          totalValue: 0,
          quoteCount: 0,
          orderCount: 0,
        };
        s.totalQty += oi.quantity || 0;
        s.totalValue += (oi.quantity || 0) * (oi.unit_price || 0);
        s.orderCount += 1;
        sellerMap.set(sellerId, s);
      }

      const topSellers = Array.from(sellerMap.values())
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 5);

      const totalQuotedQty = daily.reduce((s, d) => s + d.quotedQty, 0);
      const totalOrderedQty = daily.reduce((s, d) => s + d.orderedQty, 0);
      const totalQuotedValue = daily.reduce((s, d) => s + d.quotedValue, 0);
      const totalOrderedValue = daily.reduce((s, d) => s + d.orderedValue, 0);

      // B13 fix: conversion rate uses unique DOCUMENT counts, not item counts
      const uniqueQuoteIds = new Set((quoteItems ?? []).map((qi) => qi.quote_id));
      const uniqueOrderIds = new Set(
        (orderItems ?? []).filter((oi) => oi.order_id).map((oi) => oi.order_id),
      );
      const totalUniqueQuotes = uniqueQuoteIds.size;
      const totalUniqueOrders = uniqueOrderIds.size;

      return {
        daily,
        kpis: {
          totalQuotedQty,
          totalOrderedQty,
          totalQuotedValue,
          totalOrderedValue,
          conversionRate: totalUniqueQuotes > 0 ? (totalUniqueOrders / totalUniqueQuotes) * 100 : 0,
          uniqueSellers: sellerMap.size,
          avgOrderValue: totalUniqueOrders > 0 ? totalOrderedValue / totalUniqueOrders : 0,
          topSellers,
        },
      };
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------- Helpers ----------

function newDailyPoint(date: string): DailySalesPoint {
  return {
    date,
    quotedQty: 0,
    orderedQty: 0,
    quotedValue: 0,
    orderedValue: 0,
    quoteCount: 0,
    orderCount: 0,
  };
}

export function emptyKpis(): SalesKpis {
  return {
    totalQuotedQty: 0,
    totalOrderedQty: 0,
    totalQuotedValue: 0,
    totalOrderedValue: 0,
    conversionRate: 0,
    uniqueSellers: 0,
    avgOrderValue: 0,
    topSellers: [],
  };
}

/**
 * Helpers compartilhados para useCommercialIntelligence
 */

export function getSinceDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export interface FilterParams {
  days?: number;
  categoryId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
}

export function filterByProductIds<T extends { product_id?: string | null }>(
  items: T[],
  productIds: Set<string> | null | undefined,
): T[] {
  if (!productIds) return items;
  return items.filter((item) => item.product_id && productIds.has(item.product_id));
}

export function aggregateSegments(
  orders: Array<{ client_company?: string | null; total?: number | null }>,
) {
  const segmentMap = new Map<string, { count: number; revenue: number }>();
  orders.forEach((order) => {
    const segment = order.client_company || 'Não identificado';
    const existing = segmentMap.get(segment) || { count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += order.total ?? 0;
    segmentMap.set(segment, existing);
  });
  return [...segmentMap.entries()]
    .map(([segment, data]) => ({
      segment,
      orderCount: data.count,
      revenue: data.revenue,
      averageTicket: data.count > 0 ? data.revenue / data.count : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

export function aggregateClients(
  orders: Array<{
    client_name?: string | null;
    client_company?: string | null;
    total?: number | null;
  }>,
) {
  const clientMap = new Map<
    string,
    { company: string | null; orderCount: number; revenue: number }
  >();
  orders.forEach((o) => {
    const name = o.client_name || o.client_company || 'Não identificado';
    const existing = clientMap.get(name) || {
      company: o.client_company || null,
      orderCount: 0,
      revenue: 0,
    };
    existing.orderCount += 1;
    existing.revenue += o.total ?? 0;
    clientMap.set(name, existing);
  });
  return [...clientMap.entries()]
    .map(([name, data]) => ({
      clientName: name,
      company: data.company,
      orderCount: data.orderCount,
      revenue: data.revenue,
      averageTicket: data.orderCount > 0 ? data.revenue / data.orderCount : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

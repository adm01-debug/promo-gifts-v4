import { supabase } from '@/integrations/supabase/client';

export interface OrderLookupItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number | null;
  personalization_cost: number | null;
  subtotal: number | null;
  created_at: string;
}

export interface OrderLookup {
  id: string;
  order_number: string;
  status: string;
  total: number | null;
  subtotal: number | null;
  shipping_cost: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  created_at: string;
  updated_at: string;
  items: OrderLookupItem[];
  computedItemsSubtotal: number;
  expectedCheckoutTotal: number;
  checkoutConsistent: boolean;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function itemSubtotal(item: OrderLookupItem): number {
  if (typeof item.subtotal === 'number') return item.subtotal;
  return round2(
    item.quantity *
      (item.unit_price - (item.discount_amount ?? 0) + (item.personalization_cost ?? 0)),
  );
}

export const orderService = {
  async fetchOrderForCurrentSeller(orderId: string): Promise<OrderLookup | null> {
    const { data: order, error: orderError } = await supabase
      // rls-allow: RLS de orders escopa SELECT por created_by/assigned_to/is_manager_or_admin (+ org) — lookup por id retorna null se não for do vendedor.
      .from('orders')
      .select(
        'id, order_number, status, total, subtotal, shipping_cost, tax_amount, discount_amount, created_at, updated_at',
      )
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return null;

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(
        'id, order_id, product_id, product_name, quantity, unit_price, discount_amount, personalization_cost, subtotal, created_at',
      )
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;

    const normalizedItems = (items ?? []) as OrderLookupItem[];
    const computedItemsSubtotal = round2(
      normalizedItems.reduce((sum, item) => sum + itemSubtotal(item), 0),
    );
    const expectedCheckoutTotal = round2(
      computedItemsSubtotal -
        (order.discount_amount ?? 0) +
        (order.shipping_cost ?? 0) +
        (order.tax_amount ?? 0),
    );

    return {
      ...order,
      items: normalizedItems,
      computedItemsSubtotal,
      expectedCheckoutTotal,
      checkoutConsistent: round2(order.total ?? 0) === expectedCheckoutTotal,
    };
  },
};

/**
 * useClientOrdersHistory — agrega pedidos + LTV + ticket médio para visão 360° do cliente.
 *
 * NOTA (Caminho C / F1-5.3): a tabela `orders` foi mantida como ponte para
 * outro sistema popular no futuro. A UI de pedidos foi removida do PromoGifts,
 * mas os hooks de BI (incluindo este) continuam lendo de `orders` — vão
 * mostrar dados quando a integração externa for ligada.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subset dos campos de `orders` consumidos pela camada de BI.
 * Tipo inlineado aqui porque o antigo módulo de hooks de pedidos foi
 * removido junto com a UI de pedidos.
 */
export interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total: number | null;
  client_id: string | null;
  client_name: string | null;
  client_company: string | null;
  notes: string | null;
  seller_id: string;
  created_at: string;
  updated_at: string;
}

export interface ClientOrdersHistory {
  orders: OrderRow[];
  ordersCount: number;
  totalLtv: number;
  avgTicket: number;
  lastOrderAt: string | null;
}

export function useClientOrdersHistory(clientId?: string) {
  return useQuery<ClientOrdersHistory>({
    queryKey: ['client-orders-history', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) {
        return { orders: [], ordersCount: 0, totalLtv: 0, avgTicket: 0, lastOrderAt: null };
      }

      const { data, error } = await supabase
        // rls-allow: filtrado por client_id; RLS aplica seller scope
        .from('orders')
        .select(
          'id, order_number, status, total, client_id, client_name, client_company, notes, seller_id, created_at, updated_at',
        )
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orders = (data ?? []) as OrderRow[];
      const valid = orders.filter((o) => o.status !== 'cancelled');
      const totalLtv = valid.reduce((sum, o) => sum + (o.total ?? 0), 0);
      const ordersCount = valid.length;
      const avgTicket = ordersCount > 0 ? totalLtv / ordersCount : 0;
      const lastOrderAt = orders[0]?.created_at ?? null;

      return { orders, ordersCount, totalLtv, avgTicket, lastOrderAt };
    },
    staleTime: 5 * 60 * 1000,
  });
}

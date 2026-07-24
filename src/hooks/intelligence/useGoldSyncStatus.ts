import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GoldSyncStatus {
  /** Timestamp da última venda (orders.created_at max) — null se nunca houve pedido. */
  lastOrderAt: Date | null;
  /** Timestamp do último orçamento (quotes.created_at max) — null se nunca houve orçamento. */
  lastQuoteAt: Date | null;
  /** Timestamp do sinal mais recente entre pedidos e orçamentos. */
  lastActivityAt: Date | null;
  /** Dias desde `lastOrderAt` (Infinity se null). */
  daysSinceLastOrder: number;
  /** true quando a última venda entrou dentro da janela em dias analisada. */
  hasOrdersInWindow: (windowDays: number) => boolean;
}

/**
 * Consulta o Gold (doufsxqlfjyuvxuezpln) para descobrir quando o último pedido
 * e o último orçamento foram registrados. Não é um "cron sync" — é a evidência
 * factual de última atividade comercial, usada no painel para explicar por que
 * KPIs podem estar em zero (ausência de vendas no período ≠ falta de dados).
 */
export function useGoldSyncStatus() {
  return useQuery<GoldSyncStatus>({
    queryKey: ['gold-sync-status'],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [ordersRes, quotesRes] = await Promise.all([
        supabase
          .from('orders')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('quotes')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const lastOrderAt = ordersRes.data?.created_at
        ? new Date(ordersRes.data.created_at)
        : null;
      const lastQuoteAt = quotesRes.data?.created_at
        ? new Date(quotesRes.data.created_at)
        : null;

      const activityTs = Math.max(
        lastOrderAt?.getTime() ?? 0,
        lastQuoteAt?.getTime() ?? 0,
      );
      const lastActivityAt = activityTs > 0 ? new Date(activityTs) : null;

      const daysSinceLastOrder = lastOrderAt
        ? Math.floor((Date.now() - lastOrderAt.getTime()) / 86_400_000)
        : Number.POSITIVE_INFINITY;

      return {
        lastOrderAt,
        lastQuoteAt,
        lastActivityAt,
        daysSinceLastOrder,
        hasOrdersInWindow: (windowDays: number) =>
          Number.isFinite(daysSinceLastOrder) && daysSinceLastOrder <= windowDays,
      };
    },
  });
}

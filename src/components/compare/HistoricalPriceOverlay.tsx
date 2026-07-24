/**
 * HistoricalPriceOverlay (C6 #2) — Badge "era R$X há 30d" ao lado do preço atual.
 * Busca em price_history (ou retorna null se tabela inexistente / sem dados).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface Props {
  productId: string;
  currentPrice: number;
  enabled?: boolean;
  formatCurrency: (v: number) => string;
}

export function HistoricalPriceOverlay({
  productId,
  currentPrice,
  enabled = true,
  formatCurrency,
}: Props) {
  const [oldPrice, setOldPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setOldPrice(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const { data, error } = await supabase
          .from('price_history')
          .select('new_values, changed_at')
          .eq('variant_id', productId)
          .lte('changed_at', thirtyDaysAgo)
          .order('changed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!active || error || !data) return;
        setOldPrice(Number((data.new_values as Record<string, unknown>)?.price) || null);
      } catch {
        /* tabela inexistente — silencioso */
      }
    })();
    return () => {
      active = false;
    };
  }, [productId, enabled]);

  if (!enabled || oldPrice === null || oldPrice === currentPrice) return null;
  const diff = currentPrice - oldPrice;
  const pct = (diff / oldPrice) * 100;
  const Icon = diff < 0 ? TrendingDown : diff > 0 ? TrendingUp : Minus;
  const variant = diff < 0 ? 'default' : 'secondary';

  return (
    <Badge
      variant={variant}
      className="mt-1 gap-1 text-[10px]"
      title={`Era ${formatCurrency(oldPrice)} há 30 dias`}
    >
      <Icon className="h-3 w-3" />
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)}% (30d)
    </Badge>
  );
}

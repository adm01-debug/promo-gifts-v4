/**
 * StockRiskBadge — exibe risco de estoque baseado em estoque atual vs giro.
 * Sem hook futureStock disponível, usamos heurística: stock <= minQuantity * 2 → risco.
 */
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Product } from '@/types/product-catalog';

interface Props {
  product: Product;
}

export function StockRiskBadge({ product }: Props) {
  const stock = product.stock ?? 0;
  const min = product.minQuantity ?? 1;
  const status = product.stockStatus;

  if (status === 'out-of-stock' || stock === 0) {
    return (
      <Badge variant="destructive" className="gap-1 px-1.5 py-0.5 text-[10px]">
        <AlertTriangle className="h-3 w-3" /> Estoque zerado
      </Badge>
    );
  }
  if (stock <= min * 2 || status === 'low-stock') {
    return (
      <Badge className="gap-1 border border-warning/30 bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning hover:bg-warning/20">
        <AlertTriangle className="h-3 w-3" /> Risco &lt; 30d
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-success/40 px-1.5 py-0.5 text-[10px] text-success"
    >
      <ShieldCheck className="h-3 w-3" /> Estável
    </Badge>
  );
}

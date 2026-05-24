/**
 * StockRiskBadge — exibe risco de estoque baseado em estoque atual vs giro.
 * Sem hook futureStock disponível, usamos heurística: stock <= minQuantity * 2 → risco.
 */
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { Product } from "@/types/product-catalog";

interface Props {
  product: Product;
}

export function StockRiskBadge({ product }: Props) {
  const stock = product.stock ?? 0;
  const min = product.minQuantity ?? 1;
  const status = product.stockStatus;

  if (status === "out-of-stock" || stock === 0) {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0.5">
        <AlertTriangle className="h-3 w-3" /> Sem estoque
      </Badge>
    );
  }
  if (stock <= min * 2 || status === "low-stock") {
    return (
      <Badge className="text-[10px] gap-1 px-1.5 py-0.5 bg-warning/15 text-warning border border-warning/30 hover:bg-warning/20">
        <AlertTriangle className="h-3 w-3" /> Risco &lt; 30d
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0.5 text-success border-success/40">
      <ShieldCheck className="h-3 w-3" /> Estável
    </Badge>
  );
}

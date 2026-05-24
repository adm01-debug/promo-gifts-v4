/**
 * ComparisonDuelView — Layout 2-coluna "duelo" para compareCount === 2.
 * Fotos enormes, atributos em zebra alternada, vencedor da linha em destaque.
 */
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useComparisonScore } from "@/hooks/comparison";
import type { Product } from "@/types/product-catalog";

interface Props {
  products: Product[];
  formatCurrency: (v: number) => string;
  onRemove: (idx: number) => void;
  onProductClick?: (id: string) => void;
}

const ROWS: Array<{
  key: string;
  label: string;
  format: (p: Product) => string | number;
  raw: (p: Product) => number;
  better: "lower" | "higher";
}> = [
  { key: "price", label: "Preço unitário", format: p => p.price, raw: p => p.price, better: "lower" },
  { key: "minQty", label: "Quantidade mínima", format: p => `${p.minQuantity ?? 0} un.`, raw: p => p.minQuantity ?? 0, better: "lower" },
  { key: "stock", label: "Estoque", format: p => `${p.stock ?? 0} un.`, raw: p => p.stock ?? 0, better: "higher" },
  { key: "colors", label: "Variedade de cores", format: p => `${p.colors?.length ?? 0} opções`, raw: p => p.colors?.length ?? 0, better: "higher" },
  { key: "leadTime", label: "Lead time (dias)", format: p => p.leadTimeDays ? `${p.leadTimeDays}d` : "—", raw: p => p.leadTimeDays ?? 999, better: "lower" },
];

export function ComparisonDuelView({ products, formatCurrency, onRemove, onProductClick }: Props) {
  const scoreItems = useComparisonScore(products);
  const winnerIdx = useMemo(() => {
    if (scoreItems.length === 0) return -1;
    return scoreItems.reduce((best, cur, idx, arr) => cur.total > arr[best].total ? idx : best, 0);
  }, [scoreItems]);

  if (products.length !== 2) return null;
  const [a, b] = products;

  const renderRow = (row: typeof ROWS[number]) => {
    const va = row.raw(a);
    const vb = row.raw(b);
    let aWin = false, bWin = false;
    if (va !== vb) {
      if (row.better === "lower") {
        aWin = va < vb;
        bWin = vb < va;
      } else {
        aWin = va > vb;
        bWin = vb > va;
      }
    }
    return (
      <div key={row.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3 odd:bg-muted/30 px-4 rounded-md">
        <div className={cn("text-right text-sm font-medium tabular-nums", aWin && "text-success font-bold")}>
          {row.key === "price" ? formatCurrency(row.raw(a)) : row.format(a)}
          {aWin && <Check className="h-3.5 w-3.5 inline ml-1.5" />}
        </div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground text-center px-2">{row.label}</div>
        <div className={cn("text-left text-sm font-medium tabular-nums", bWin && "text-success font-bold")}>
          {bWin && <Check className="h-3.5 w-3.5 inline mr-1.5" />}
          {row.key === "price" ? formatCurrency(row.raw(b)) : row.format(b)}
        </div>
      </div>
    );
  };

  const renderHeader = (p: Product, idx: number, side: "left" | "right") => (
    <div className={cn("space-y-3", side === "right" && "lg:text-right")}>
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted border-2 border-border group">
        <img
          src={p.images?.[0]}
          alt={p.name}
          className="w-full h-full object-contain p-4 cursor-pointer transition-transform group-hover:scale-105"
          onClick={() => onProductClick?.(p.id)}
          loading="lazy"
        />
        {winnerIdx === idx && (
          <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground gap-1 shadow-lg">
            <Crown className="h-3 w-3" />
            Recomendado
          </Badge>
        )}
        <button
          aria-label="Remover"
          onClick={() => onRemove(idx)}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <h3
        className="font-display text-lg font-bold cursor-pointer hover:text-primary transition-colors line-clamp-2"
        onClick={() => onProductClick?.(p.id)}
      >
        {p.name}
      </h3>
      <p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(p.price)}</p>
      {p.supplier?.name && (
        <p className="text-xs text-muted-foreground">por {p.supplier.name}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6 rounded-2xl border-2 border-primary/20 bg-card p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-center gap-3 pb-2">
        <Badge variant="outline" className="text-xs">⚔️ Modo Duelo</Badge>
        <span className="text-xs text-muted-foreground">Comparação 1 a 1 com destaques</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">
        {renderHeader(a, 0, "left")}
        <div className="hidden lg:flex flex-col items-center justify-center pt-32">
          <div className="w-px h-32 bg-border" />
          <span className="text-2xl font-display font-bold text-muted-foreground my-4">VS</span>
          <div className="w-px h-32 bg-border" />
        </div>
        <div className="lg:hidden flex items-center justify-center py-2">
          <span className="text-xl font-display font-bold text-muted-foreground">VS</span>
        </div>
        {renderHeader(b, 1, "right")}
      </div>

      <div className="space-y-1 pt-4 border-t border-border">
        {ROWS.map(renderRow)}
      </div>

      <div className="flex justify-center gap-3 pt-2">
        <Button variant="outline" onClick={() => onProductClick?.(a.id)}>
          Ver {a.name.slice(0, 22)}
        </Button>
        <Button variant="outline" onClick={() => onProductClick?.(b.id)}>
          Ver {b.name.slice(0, 22)}
        </Button>
      </div>
    </div>
  );
}

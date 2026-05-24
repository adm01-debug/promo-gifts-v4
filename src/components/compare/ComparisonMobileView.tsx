/**
 * ComparisonMobileView — Carousel vertical de atributos para mobile (<768px).
 * Cada linha = atributo, produtos viram chips horizontais swipeable.
 */
import { Badge } from "@/components/ui/badge";
import type { Product, ProductColor } from "@/types/product-catalog";
import { Button } from "@/components/ui/button";
import { X, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useComparisonScore } from "@/hooks/comparison";

interface Props {
  products: Product[];
  formatCurrency: (v: number) => string;
  onRemove: (idx: number) => void;
  onProductClick?: (id: string) => void;
}

const ROWS = [
  { key: "image", label: "Foto" },
  { key: "name", label: "Produto" },
  { key: "price", label: "Preço" },
  { key: "minQty", label: "Qtd. mínima" },
  { key: "stock", label: "Estoque" },
  { key: "colors", label: "Cores" },
  { key: "supplier", label: "Fornecedor" },
] as const;

export function ComparisonMobileView({ products, formatCurrency, onRemove, onProductClick }: Props) {
  const scoreItems = useComparisonScore(products);
  const winnerIdx = scoreItems.length > 0
    ? scoreItems.reduce((best, cur, idx, arr) => cur.total > arr[best].total ? idx : best, 0)
    : -1;

  const renderCell = (rowKey: typeof ROWS[number]["key"], p: Product, idx: number) => {
    switch (rowKey) {
      case "image":
        return (
          <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-muted">
            <img src={p.images?.[0]} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
            {winnerIdx === idx && (
              <Badge className="absolute top-1 left-1 text-[9px] gap-0.5 px-1 py-0">
                <Crown className="h-2.5 w-2.5" />
              </Badge>
            )}
            <button
              aria-label="Remover"
              onClick={() => onRemove(idx)}
              className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      case "name":
        return (
          <button
            onClick={() => onProductClick?.(p.id)}
            className="text-xs font-medium text-left line-clamp-2 hover:text-primary"
          >
            {p.name}
          </button>
        );
      case "price":
        return <span className="text-sm font-bold text-primary">{formatCurrency(p.price)}</span>;
      case "minQty":
        return <span className="text-xs">{p.minQuantity ?? 0} un.</span>;
      case "stock":
        return <span className="text-xs">{p.stock ?? 0}</span>;
      case "colors":
        return (
          <div className="flex gap-0.5 flex-wrap">
            {(p.colors ?? []).slice(0, 4).map((c: ProductColor, i: number) => (
              <div key={i} className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: c.hex }} />
            ))}
            {p.colors?.length > 4 && <span className="text-[10px]">+{p.colors.length - 4}</span>}
          </div>
        );
      case "supplier":
        return <span className="text-[10px] text-muted-foreground line-clamp-1">{p.supplier?.name ?? "—"}</span>;
    }
  };

  return (
    <div className="md:hidden space-y-3">
      {ROWS.map((row) => (
        <div key={row.key} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border">
            {row.label}
          </div>
          <div className="flex gap-2 p-2 overflow-x-auto snap-x snap-mandatory scrollbar-thin">
            {products.map((p, idx) => (
              <div
                key={`${p.id}-${idx}`}
                className={cn(
                  "shrink-0 snap-start min-w-[42%] max-w-[42%] flex items-center justify-center p-2 rounded-lg border border-border bg-background",
                  winnerIdx === idx && "border-primary/60 ring-1 ring-primary/30"
                )}
              >
                {renderCell(row.key, p, idx)}
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onProductClick?.(products[0]?.id)}>
        Ver detalhes do primeiro produto
      </Button>
    </div>
  );
}

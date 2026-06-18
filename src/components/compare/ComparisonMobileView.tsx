/**
 * ComparisonMobileView — Carousel vertical de atributos para mobile (<768px).
 * Cada linha = atributo, produtos viram chips horizontais swipeable.
 */
import { Badge } from '@/components/ui/badge';
import type { Product, ProductColor } from '@/types/product-catalog';
import { Button } from '@/components/ui/button';
import { X, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useComparisonScore } from '@/hooks/comparison';

interface Props {
  products: Product[];
  formatCurrency: (v: number) => string;
  onRemove: (idx: number) => void;
  onProductClick?: (id: string) => void;
}

const ROWS = [
  { key: 'image', label: 'Foto' },
  { key: 'name', label: 'Produto' },
  { key: 'price', label: 'Preço' },
  { key: 'minQty', label: 'Qtd. mínima' },
  { key: 'stock', label: 'Estoque' },
  { key: 'colors', label: 'Cores' },
  { key: 'supplier', label: 'Fornecedor' },
] as const;

export function ComparisonMobileView({
  products,
  formatCurrency,
  onRemove,
  onProductClick,
}: Props) {
  const scoreItems = useComparisonScore(products);
  const winnerIdx =
    scoreItems.length > 0
      ? scoreItems.reduce((best, cur, idx, arr) => (cur.total > arr[best].total ? idx : best), 0)
      : -1;

  const renderCell = (rowKey: (typeof ROWS)[number]['key'], p: Product, idx: number) => {
    switch (rowKey) {
      case 'image':
        return (
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
            <img
              src={p.images?.[0]}
              alt={p.name}
              className="h-full w-full object-contain"
              loading="lazy"
            />
            {winnerIdx === idx && (
              <Badge className="absolute left-1 top-1 gap-0.5 px-1 py-0 text-[9px]">
                <Crown className="h-2.5 w-2.5" />
              </Badge>
            )}
            <button
              aria-label="Remover"
              onClick={() => onRemove(idx)}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      case 'name':
        return (
          <button
            onClick={() => onProductClick?.(p.id)}
            className="line-clamp-2 text-left text-xs font-medium hover:text-primary"
          >
            {p.name}
          </button>
        );
      case 'price':
        return <span className="text-sm font-bold text-primary">{formatCurrency(p.price)}</span>;
      case 'minQty':
        return <span className="text-xs">{p.minQuantity ?? 0} un.</span>;
      case 'stock':
        return <span className="text-xs">{p.stock ?? 0}</span>;
      case 'colors':
        return (
          <div className="flex flex-wrap gap-0.5">
            {(p.colors ?? []).slice(0, 4).map((c: ProductColor, i: number) => (
              <div
                key={i}
                className="h-3 w-3 rounded-full border border-border"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {p.colors?.length > 4 && <span className="text-[10px]">+{p.colors.length - 4}</span>}
          </div>
        );
      case 'supplier':
        return (
          <span className="line-clamp-1 text-[10px] text-muted-foreground">
            {p.supplier?.name ?? '—'}
          </span>
        );
      // no default
    }
  };

  return (
    <div className="space-y-3 md:hidden">
      {ROWS.map((row) => (
        <div key={row.key} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {row.label}
          </div>
          <div className="scrollbar-thin flex snap-x snap-mandatory gap-2 overflow-x-auto p-2">
            {products.map((p, idx) => (
              <div
                key={`${p.id}-${idx}`}
                className={cn(
                  'flex min-w-[42%] max-w-[42%] shrink-0 snap-start items-center justify-center rounded-lg border border-border bg-background p-2',
                  winnerIdx === idx && 'border-primary/60 ring-1 ring-primary/30',
                )}
              >
                {renderCell(row.key, p, idx)}
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onProductClick?.(products[0]?.id)}
      >
        Ver detalhes do primeiro produto
      </Button>
    </div>
  );
}

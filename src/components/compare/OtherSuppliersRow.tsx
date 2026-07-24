/**
 * OtherSuppliersRow — linha expansível mostrando alternativas de outros fornecedores.
 * Usa useSupplierComparison existente.
 */
import { useState } from 'react';
import { ChevronDown, Building2, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSupplierComparison } from '@/hooks/products';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/types/product-catalog';

interface Props {
  product: Product;
  formatCurrency: (v: number) => string;
  onAddToCompare?: (productId: string) => void;
}

export function OtherSuppliersRow({ product, formatCurrency, onAddToCompare }: Props) {
  const [open, setOpen] = useState(false);
  const { result, isLoading } = useSupplierComparison(open ? product : null);

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium transition-colors hover:bg-muted/40"
      >
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Outros fornecedores deste produto
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border p-3">
          {isLoading && (
            <p className="py-2 text-center text-[11px] text-muted-foreground">
              Buscando alternativas...
            </p>
          )}
          {result?.alternatives.length === 0 && (
            <p className="py-2 text-center text-[11px] text-muted-foreground">
              Nenhum fornecedor alternativo encontrado.
            </p>
          )}
          {result?.alternatives.slice(0, 3).map((alt) => (
            <div key={alt.product.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{alt.product.supplier?.name}</p>
                <p className="truncate text-muted-foreground">{alt.product.name}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold tabular-nums text-primary">
                  {formatCurrency(alt.product.price)}
                </p>
                {alt.priceDiff < 0 && (
                  <Badge className="gap-0.5 border-success/30 bg-success/15 text-[9px] text-success hover:bg-success/20">
                    <TrendingDown className="h-2.5 w-2.5" /> {alt.priceDiffPercent.toFixed(1)}%
                  </Badge>
                )}
              </div>
              {onAddToCompare && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => onAddToCompare(alt.product.id)}
                >
                  + Comparar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

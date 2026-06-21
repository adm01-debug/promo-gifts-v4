/**
 * ProductLoaderAndColorSelector — extracted from MockupProductSelector
 */
import { useMemo, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useExternalVariantStock,
  useProduct,
  type ExternalVariantStock,
  type Product,
} from '@/hooks/products';

interface Props {
  productId: string;
  onSelect: (variant: ExternalVariantStock | null, product: Product) => void;
  onBack: () => void;
}

export function ProductLoaderAndColorSelector({ productId, onSelect, onBack }: Props) {
  const { data: fullProduct, isLoading: isLoadingProduct } = useProduct(productId);
  const { data: variants, isLoading: isLoadingVariants } = useExternalVariantStock(productId);

  const sortedVariants = useMemo(() => {
    if (!variants) return [];
    return [...variants].sort((a, b) => {
      const aStock = a.stock_quantity ?? 0;
      const bStock = b.stock_quantity ?? 0;
      if (aStock > 0 && bStock === 0) return -1;
      if (aStock === 0 && bStock > 0) return 1;
      return (a.color_name ?? '').localeCompare(b.color_name ?? '');
    });
  }, [variants]);

  const totalStock = useMemo(
    () => sortedVariants.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0),
    [sortedVariants],
  );

  // BUG-24 FIX: was `setTimeout(() => onSelect(null, fullProduct), 0)` directly in
  // the render body — a side-effect inside render fires on every re-render and
  // double-fires under React 18 StrictMode, causing onSelect to be called multiple
  // times before setPendingProductId(null) could unmount this component.
  // Hook placed BEFORE all early returns to satisfy Rules of Hooks.
  useEffect(() => {
    if (
      !isLoadingProduct &&
      !isLoadingVariants &&
      fullProduct &&
      (!variants || variants.length === 0)
    ) {
      onSelect(null, fullProduct);
    }
  }, [isLoadingProduct, isLoadingVariants, fullProduct, variants, onSelect]);

  const formatStock = (qty: number) =>
    qty >= 1000 ? `${(qty / 1000).toFixed(1)}k` : qty.toString();

  if (isLoadingProduct || isLoadingVariants) {
    return (
      <div className="space-y-4 rounded-lg border border-border/30 p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando detalhes...
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!fullProduct) {
    return (
      <div className="space-y-4 rounded-lg border border-border/30 p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
        </div>
        <div role="alert" className="py-6 text-center text-muted-foreground">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 opacity-50" aria-hidden="true" />
          <p>Produto não encontrado</p>
        </div>
      </div>
    );
  }

  if (!variants || variants.length === 0) {
    return (
      <div className="flex animate-pulse items-center gap-3 rounded-lg border border-border/30 bg-card p-3">
        <Skeleton className="h-11 w-11 rounded-lg" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/30 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-medium">{fullProduct.name}</h4>
          <p className="text-[11px] text-muted-foreground">
            {sortedVariants.length} cores · Estoque total: {formatStock(totalStock)}
          </p>
        </div>
      </div>
      <div className="grid max-h-[280px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {sortedVariants.map((variant) => {
          const outOfStock = (variant.stock_quantity ?? 0) === 0;
          const thumbSrc =
            variant.selected_thumbnail ||
            variant.images?.[0] ||
            fullProduct.images?.[0] ||
            '/placeholder.svg';
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant, fullProduct)}
              className={cn(
                'group relative flex flex-col items-center gap-1.5 rounded-lg border p-2 text-left transition-all duration-200',
                outOfStock
                  ? 'border-border/20 opacity-60 hover:opacity-80'
                  : 'border-border/30 hover:border-primary/40 hover:bg-accent/40',
              )}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                <img
                  src={thumbSrc}
                  alt={variant.color_name || 'Variante'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
                {outOfStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                )}
              </div>
              <div className="flex w-full items-center gap-1.5">
                {variant.color_hex && (
                  <div
                    className="h-3 w-3 shrink-0 rounded-full border border-border/50"
                    style={{ backgroundColor: variant.color_hex }}
                  />
                )}
                <span className="truncate text-[11px] font-medium">
                  {variant.color_name || 'Sem cor'}
                </span>
              </div>
              <div className="w-full">
                {!outOfStock ? (
                  <span className="text-[10px] text-primary">
                    ⊕ {formatStock(variant.stock_quantity ?? 0)} un
                  </span>
                ) : (
                  <span className="text-[10px] text-destructive">△ Estoque zerado</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

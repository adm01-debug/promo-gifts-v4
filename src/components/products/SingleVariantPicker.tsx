/**
 * SingleVariantPicker — Seletor inline de cor/variante para um único produto.
 * Reutilizável em Popovers, Modais e fluxos individuais.
 */
import { useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Package, AlertTriangle, SkipForward } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useExternalVariantStock, type ExternalVariantStock } from '@/hooks/products';

interface SingleVariantPickerProps {
  productId: string;
  onSelect: (variant: ExternalVariantStock | null) => void;
  compact?: boolean;
  className?: string;
}

export function SingleVariantPicker({ productId, onSelect, compact, className }: SingleVariantPickerProps) {
  const { data: variants, isLoading } = useExternalVariantStock(productId);

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

  const fmt = (qty: number) => (qty >= 1000 ? `${(qty / 1000).toFixed(1)}k` : qty.toString());

  // Auto-skip when no variants — use setTimeout to let dialog mount first
  useEffect(() => {
    if (!isLoading && !sortedVariants.length) {
      const t = setTimeout(() => onSelect(null), 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, sortedVariants.length]);

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        <p className="text-xs font-medium text-muted-foreground">Carregando variações...</p>
        <div className="grid grid-cols-2 gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!sortedVariants.length) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-muted-foreground">Escolha a cor/variação</p>

      {/* Skip option */}
      <button
        type="button"
        data-testid="variant-picker-no-variant"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(null);
        }}
        className="w-full flex items-center gap-2 p-2 rounded-lg border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left text-xs text-muted-foreground group"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-destructive/70 via-success/70 to-info/70 border border-border/50 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="flex-1">Sem cor específica</span>
        <SkipForward className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Variant grid */}
      <div className={cn(
        'grid gap-1.5 overflow-y-auto pr-0.5 scrollbar-thin',
        compact ? 'grid-cols-1 max-h-36' : 'grid-cols-2 max-h-48',
      )}>
        {sortedVariants.map((variant) => {
          const stock = variant.stock_quantity ?? 0;
          const isOutOfStock = stock === 0;
          const isLowStock = stock > 0 && stock < 100;

          return (
            <button
              type="button"
              key={variant.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(variant);
              }}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border transition-all text-left group',
                'hover:border-primary/50 hover:bg-accent/60 hover:shadow-sm',
                isOutOfStock
                  ? 'opacity-50 border-border/40 bg-muted/20'
                  : 'border-border/60 bg-card',
              )}
            >
              {variant.selected_thumbnail ? (
                <img
                  src={`${variant.selected_thumbnail}/thumbnail`}
                  alt={variant.color_name ?? ''}
                  className="w-8 h-8 rounded-md object-cover border border-border/50 shrink-0 group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    const t = e.currentTarget;
                    if (t.src.includes('/thumbnail')) t.src = variant.selected_thumbnail!;
                    else t.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-md border border-border/50 shrink-0 group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: variant.color_hex || '#CCC' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate leading-tight">
                  {variant.color_name || 'Sem nome'}
                  {variant.size_code && (
                    <span className="text-muted-foreground ml-1">— {variant.size_code}</span>
                  )}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {isOutOfStock ? (
                    <span className="text-[9px] text-destructive flex items-center gap-0.5">
                      <AlertTriangle className="h-2 w-2" /> Sem estoque
                    </span>
                  ) : (
                    <span className={cn('text-[9px] font-medium flex items-center gap-0.5', isLowStock ? 'text-warning' : 'text-success')}>
                      <Package className="h-2 w-2" /> {fmt(stock)} un
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

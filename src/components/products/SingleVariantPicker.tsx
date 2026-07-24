/**
 * SingleVariantPicker — Seletor inline de cor/variante para um único produto.
 * Reutilizável em Popovers, Modais e fluxos individuais.
 */
import { useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';
import { Package, AlertTriangle, SkipForward } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useExternalVariantStock,
  type ExternalVariantStock,
} from '@/hooks/products/useExternalVariantStock';
import { CATALOG_LOW_STOCK_THRESHOLD } from '@/lib/catalog-stock-status';

// BUG-SVP-03 FIX (2026-06-21): fmt criado dentro do componente → nova instância por render.
// Mover para módulo evita recrição desnecessária.
const fmt = (qty: number) => (qty >= 1000 ? `${(qty / 1000).toFixed(1)}k` : qty.toString());

interface SingleVariantPickerProps {
  productId: string;
  onSelect: (variant: ExternalVariantStock | null) => void;
  compact?: boolean;
  className?: string;
}

export function SingleVariantPicker({
  productId,
  onSelect,
  compact,
  className,
}: SingleVariantPickerProps) {
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
        className="group flex w-full items-center gap-2 rounded-lg border border-dashed border-border/60 p-2 text-left text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5"
      >
        <div className="h-6 w-6 shrink-0 rounded-full border border-border/50 bg-gradient-to-br from-destructive/70 via-success/70 to-info/70 transition-transform group-hover:scale-110" />
        <span className="flex-1">Sem cor específica</span>
        <SkipForward className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
      </button>

      {/* Variant grid */}
      <div
        className={cn(
          'scrollbar-thin grid gap-1.5 overflow-y-auto pr-0.5',
          compact ? 'max-h-36 grid-cols-1' : 'max-h-48 grid-cols-2',
        )}
      >
        {sortedVariants.map((variant) => {
          const stock = variant.stock_quantity ?? 0;
          // BUG-SVP-01 FIX (2026-06-21): stock === 0 perdia estoque negativo (← DB legado).
          // BUG-SVP-02 FIX (2026-06-21): limiar low-stock era 100 — SSOT é CATALOG_LOW_STOCK_THRESHOLD (10).
          const isOutOfStock = stock <= 0;
          const isLowStock = stock > 0 && stock < CATALOG_LOW_STOCK_THRESHOLD;

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
                'group flex items-center gap-2 rounded-lg border p-2 text-left transition-all',
                'hover:border-primary/50 hover:bg-accent/60 hover:shadow-sm',
                isOutOfStock
                  ? 'border-border/40 bg-muted/20 opacity-50'
                  : 'border-border/60 bg-card',
              )}
            >
              {variant.selected_thumbnail ? (
                <img
                  src={getCdnUrl(variant.selected_thumbnail, 'thumbnail')}
                  alt={variant.color_name ?? ''}
                  className="h-8 w-8 shrink-0 rounded-md border border-border/50 object-cover transition-transform group-hover:scale-105"
                  onError={(e) => {
                    const t = e.currentTarget;
                    if (t.src.includes('/thumbnail')) t.src = variant.selected_thumbnail ?? '';
                    else t.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="h-8 w-8 shrink-0 rounded-md border border-border/50 transition-transform group-hover:scale-105"
                  style={{ backgroundColor: variant.color_hex || '#CCC' }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium leading-tight">
                  {variant.color_name || 'Sem nome'}
                  {variant.size_code && (
                    <span className="ml-1 text-muted-foreground">— {variant.size_code}</span>
                  )}
                </p>
                <div className="mt-0.5 flex items-center gap-1">
                  {isOutOfStock ? (
                    <span className="flex items-center gap-0.5 text-[9px] text-destructive">
                      <AlertTriangle className="h-2 w-2" /> Estoque zerado
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'flex items-center gap-0.5 text-[9px] font-medium',
                        isLowStock ? 'text-warning' : 'text-success',
                      )}
                    >
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

/**
 * QuoteProductColorSelector — Seletor de cor/variante com estoque
 * para o fluxo de adicionar produto ao orçamento.
 * Inclui suporte a size_code quando disponível.
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Check, Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExternalVariantStock, type ExternalVariantStock } from '@/hooks/products';

interface QuoteProductColorSelectorProps {
  product: {
    id: string;
    name: string;
    sku: string;
    price: number;
    images: string[] | null;
  };
  onSelect: (variant: ExternalVariantStock | null) => void;
  onBack: () => void;
}

export function QuoteProductColorSelector({ product, onSelect, onBack }: QuoteProductColorSelectorProps) {
  const { data: variants, isLoading } = useExternalVariantStock(product.id);

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

  const totalStock = useMemo(() => {
    return sortedVariants.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0);
  }, [sortedVariants]);

  const formatStock = (qty: number) => {
    if (qty >= 1000) return `${(qty / 1000).toFixed(1)}k`;
    return qty.toString();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Sem variantes = adicionar sem cor
  if (!sortedVariants.length) {
    onSelect(null);
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header com info do produto */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{product.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <Package className="h-3 w-3" />
          {formatStock(totalStock)} total
        </Badge>
      </div>

      {/* Opção sem cor específica */}
      <button
        onClick={() => onSelect(null)}
        className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-colors text-left text-sm text-muted-foreground"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-destructive/80 via-success/80 to-info/80 border border-border shrink-0" />
        <span>Adicionar sem cor específica</span>
      </button>

      {/* Grid de cores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
        {sortedVariants.map((variant) => {
          const stock = variant.stock_quantity ?? 0;
          const isOutOfStock = stock === 0;
          const isLowStock = stock > 0 && stock < 100;

          return (
            <button
              key={variant.id}
              onClick={() => onSelect(variant)}
              className={cn(
                'relative flex items-center gap-2.5 p-3 rounded-lg border transition-all text-left',
                'hover:border-primary/50 hover:bg-accent',
                isOutOfStock
                  ? 'opacity-60 border-border bg-muted/30'
                  : 'border-border bg-card'
              )}
            >
              {/* Thumbnail ou swatch */}
              {variant.selected_thumbnail ? (
                <img
                  src={`${variant.selected_thumbnail}/thumbnail`}
                  alt={variant.color_name ?? ''}
                  className="w-10 h-10 rounded-md object-cover border border-border shrink-0"
                  onError={(e) => {
                    const t = e.currentTarget;
                    if (t.src.includes('/thumbnail')) {
                      t.src = variant.selected_thumbnail!;
                    } else {
                      t.style.display = 'none';
                    }
                  }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-md border border-border shrink-0"
                  style={{ backgroundColor: variant.color_hex || '#CCC' }}
                />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {variant.color_name || 'Sem nome'}
                  {variant.size_code && (
                    <span className="text-muted-foreground ml-1">— {variant.size_code}</span>
                  )}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {isOutOfStock ? (
                    <span className="text-[10px] text-destructive flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Sem estoque
                    </span>
                  ) : (
                    <span className={cn(
                      'text-[10px] font-medium',
                      isLowStock ? 'text-warning' : 'text-success'
                    )}>
                      <Package className="h-2.5 w-2.5 inline mr-0.5" />
                      {formatStock(stock)} un
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

/**
 * QuoteProductColorSelector — Seletor de cor/variante com estoque
 * para o fluxo de adicionar produto ao orçamento.
 * Inclui suporte a size_code quando disponível.
 */

import { useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';
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

export function QuoteProductColorSelector({
  product,
  onSelect,
  onBack,
}: QuoteProductColorSelectorProps) {
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

  // Calling onSelect during render violates React rules (StrictMode crash).
  // Use an effect to notify parent when the loaded product has no variants.
  useEffect(() => {
    if (!isLoading && variants !== undefined && sortedVariants.length === 0) {
      onSelect(null);
    }
  }, [isLoading, variants, sortedVariants.length, onSelect]);

  const formatStock = (qty: number) => {
    if (qty >= 1000) return `${(qty / 1000).toFixed(1)}k`;
    return qty.toString();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Sem variantes — useEffect notifies parent; return null to unmount
  if (!isLoading && !sortedVariants.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header com info do produto */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{product.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
        </div>
        <Badge variant="outline" className="gap-1 text-xs">
          <Package className="h-3 w-3" />
          {formatStock(totalStock)} total
        </Badge>
      </div>

      {/* Aviso inline: cor é obrigatória — clique em uma cor disponível para adicionar */}
      <div
        role="status"
        data-testid="color-required-hint"
        className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground"
      >
        <strong className="font-semibold">Selecione uma cor</strong> na grade abaixo para
        adicionar o produto ao orçamento. Cores com estoque zerado estão desabilitadas.
      </div>

      {/* Grid de cores — cada tile funciona como botão "adicionar nesta cor".
          Tiles sem estoque ficam desabilitados (aria-disabled) para impedir avanço sem
          cor válida. */}
      <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {sortedVariants.map((variant) => {
          const stock = variant.stock_quantity ?? 0;
          const isOutOfStock = stock === 0;
          const isLowStock = stock > 0 && stock < 100;
          const colorLabel = variant.color_name || 'Sem nome';
          const ariaLabel = isOutOfStock
            ? `Cor ${colorLabel} indisponível — estoque zerado`
            : `Adicionar na cor ${colorLabel}, ${stock} em estoque`;

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => {
                if (isOutOfStock) return;
                onSelect(variant);
              }}
              disabled={isOutOfStock}
              aria-disabled={isOutOfStock}
              aria-label={ariaLabel}
              data-testid={`color-variant-tile${isOutOfStock ? '-disabled' : ''}`}
              className={cn(
                'relative flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                isOutOfStock
                  ? 'cursor-not-allowed border-border bg-muted/30 opacity-60'
                  : 'cursor-pointer border-border bg-card hover:border-primary/50 hover:bg-accent',
              )}
            >
              {/* Thumbnail ou swatch */}
              {variant.selected_thumbnail ? (
                <img
                  src={getCdnUrl(variant.selected_thumbnail, 'thumbnail')}
                  alt={variant.color_name ?? ''}
                  className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                  onError={(e) => {
                    const t = e.currentTarget;
                    if (t.src.includes('/thumbnail')) {
                      t.src = variant.selected_thumbnail ?? '';
                    } else {
                      t.style.display = 'none';
                    }
                  }}
                />
              ) : (
                <div
                  className="h-10 w-10 shrink-0 rounded-md border border-border"
                  style={{ backgroundColor: variant.color_hex || '#CCC' }}
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {colorLabel}
                  {variant.size_code && (
                    <span className="ml-1 text-muted-foreground">— {variant.size_code}</span>
                  )}
                </p>
                <div className="mt-0.5 flex items-center gap-1">
                  {isOutOfStock ? (
                    <span className="flex items-center gap-0.5 text-[10px] text-destructive">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Estoque zerado
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'text-[10px] font-medium',
                        isLowStock ? 'text-warning' : 'text-success',
                      )}
                    >
                      <Package className="mr-0.5 inline h-2.5 w-2.5" />
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

/**
 * QuoteProductColorSelector — Seletor de cor/variante com estoque
 * para o fluxo de adicionar produto ao orçamento.
 * Inclui suporte a size_code quando disponível.
 */

import { useMemo, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  const [pendingOutOfStock, setPendingOutOfStock] = useState<ExternalVariantStock | null>(null);

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <div className="min-w-0 flex-1">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Badge
                    variant="secondary"
                    aria-label={`Código do produto: ${product.sku}`}
                    data-testid="quote-product-sku-badge"
                    className="mb-1 rounded-md px-1.5 py-0 font-mono text-[11px] font-medium leading-none"
                  >
                    {product.sku}
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">SKU: {product.sku}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="truncate text-sm font-medium" data-testid="quote-product-name">{product.name}</p>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1 text-xs">
          <Package className="h-3 w-3" />
          {formatStock(totalStock)} total
        </Badge>
      </div>


      {/* Grid de cores — cada tile funciona como botão "adicionar nesta cor".
          Tiles sem estoque pedem confirmação antes de adicionar. */}
      <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {sortedVariants.map((variant) => {
          const stock = variant.stock_quantity ?? 0;
          const isOutOfStock = stock === 0;
          const isLowStock = stock > 0 && stock < 100;
          const colorLabel = variant.color_name || 'Sem nome';
          const ariaLabel = isOutOfStock
            ? `Adicionar cor ${colorLabel} mesmo com estoque zerado (requer confirmação)`
            : `Adicionar na cor ${colorLabel}, ${stock} em estoque`;

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => {
                if (isOutOfStock) {
                  setPendingOutOfStock(variant);
                  return;
                }
                onSelect(variant);
              }}
              aria-label={ariaLabel}
              data-testid={`color-variant-tile${isOutOfStock ? '-out-of-stock' : ''}`}
              className={cn(
                'relative flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                isOutOfStock
                  ? 'border-destructive/40 bg-destructive/5 hover:border-destructive/70 hover:bg-destructive/10'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-accent',
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

      <AlertDialog
        open={pendingOutOfStock !== null}
        onOpenChange={(open) => {
          if (!open) setPendingOutOfStock(null);
        }}
      >
        <AlertDialogContent
          className="!max-w-[400px] w-[92vw] gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl backdrop-blur-xl"
          data-testid="out-of-stock-confirm-dialog"
          aria-labelledby="oos-confirm-title"
          aria-describedby="oos-confirm-desc"
        >
          <div aria-hidden="true" className="h-[3px] w-full bg-gradient-to-r from-transparent via-warning to-transparent" />
          <div className="px-4 pb-1.5 pt-4">
            <AlertDialogHeader>
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-xl blur-lg opacity-60 bg-warning/30" />
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 ring-1 ring-inset ring-warning/20">
                    <AlertTriangle className="h-[18px] w-[18px] text-warning" strokeWidth={2.2} />
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                  <AlertDialogTitle id="oos-confirm-title" className="text-sm font-semibold leading-tight tracking-tight text-foreground">
                    Estoque zerado no fornecedor
                  </AlertDialogTitle>
                  <AlertDialogDescription id="oos-confirm-desc" className="text-xs leading-relaxed text-muted-foreground">
                    O estoque da cor{' '}
                    <strong className="text-foreground">
                      {pendingOutOfStock?.color_name || 'selecionada'}
                    </strong>{' '}
                    está zerado no fornecedor. Você tem certeza que quer adicioná-la ao orçamento?
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
          </div>
          <div className="mt-3 border-t border-border/50 bg-muted/20 px-4 py-2.5">
            <AlertDialogFooter className="gap-1.5 sm:gap-1.5">
              <AlertDialogCancel data-testid="out-of-stock-confirm-cancel" className="mt-0 h-[26px] min-h-[26px] rounded-md border-border/70 bg-transparent px-3 py-0 text-xs">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                data-testid="out-of-stock-confirm-accept"
                autoFocus
                onClick={() => {
                  const v = pendingOutOfStock;
                  setPendingOutOfStock(null);
                  if (v) onSelect(v);
                }}
                className="inline-flex h-[26px] min-h-[26px] items-center rounded-md px-3.5 text-xs font-semibold"
              >
                Adicionar mesmo assim
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

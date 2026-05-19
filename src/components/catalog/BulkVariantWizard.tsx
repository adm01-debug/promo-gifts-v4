/**
 * BulkVariantWizard — Wizard modal para selecionar cor/variante de cada produto
 * antes de adicioná-los em lote ao carrinho ou orçamento.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Package, AlertTriangle, SkipForward, ShoppingBag, FileText, Heart, GitCompare, FolderPlus,
} from 'lucide-react';
import { useExternalVariantStock, type ExternalVariantStock } from '@/hooks/products';
import type { Product } from '@/hooks/products';
import { motion, AnimatePresence } from 'framer-motion';

export interface BulkVariantSelection {
  product: Product;
  variant: ExternalVariantStock | null;
}

export type BulkWizardMode = 'cart' | 'quote' | 'favorite' | 'compare' | 'collection';

interface BulkVariantWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  mode: BulkWizardMode;
  onComplete: (selections: BulkVariantSelection[]) => void;
}

/* ── Step: variant picker for a single product ── */
function ProductVariantStep({
  product,
  onSelect,
  onSkip,
  stepIndex,
  totalSteps,
}: {
  product: Product;
  onSelect: (variant: ExternalVariantStock | null) => void;
  onSkip: () => void;
  stepIndex: number;
  totalSteps: number;
}) {
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

  const totalStock = useMemo(
    () => sortedVariants.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0),
    [sortedVariants],
  );

  const fmt = (qty: number) => (qty >= 1000 ? `${(qty / 1000).toFixed(1)}k` : qty.toString());

  // Auto-skip if no variants found
  useEffect(() => {
    if (!isLoading && sortedVariants.length === 0) {
      onSkip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, sortedVariants.length]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ProductHeader product={product} step={stepIndex} total={totalSteps} />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (sortedVariants.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-3"
    >
      {/* Product info card */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
        {product.images?.[0] && (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-12 h-12 rounded-lg object-cover border border-border/60 shrink-0 shadow-sm"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate leading-tight">{product.name}</p>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{product.sku}</p>
        </div>
        <Badge variant="outline" className="text-[10px] gap-1 shrink-0 border-success/30 text-success">
          <Package className="h-3 w-3" />
          {fmt(totalStock)}
        </Badge>
      </div>

      {/* Skip / add without color */}
      <button
        onClick={onSkip}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left text-sm text-muted-foreground group"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-destructive/70 via-success/70 to-info/70 border border-border/50 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="flex-1">Sem cor específica</span>
        <SkipForward className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Variant grid */}
      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
        {sortedVariants.map((variant) => {
          const stock = variant.stock_quantity ?? 0;
          const isOutOfStock = stock === 0;
          const isLowStock = stock > 0 && stock < 100;

          return (
            <button
              key={variant.id}
              onClick={() => onSelect(variant)}
              className={cn(
                'relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left group',
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
                  className="w-10 h-10 rounded-lg object-cover border border-border/50 shrink-0 shadow-sm group-hover:scale-105 transition-transform"
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
                  className="w-10 h-10 rounded-lg border border-border/50 shrink-0 shadow-sm group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: variant.color_hex || '#CCC' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate leading-tight">
                  {variant.color_name || 'Sem nome'}
                  {variant.size_code && (
                    <span className="text-muted-foreground ml-1">— {variant.size_code}</span>
                  )}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {isOutOfStock ? (
                    <span className="text-[10px] text-destructive flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Sem estoque
                    </span>
                  ) : (
                    <span className={cn('text-[10px] font-medium flex items-center gap-0.5', isLowStock ? 'text-warning' : 'text-success')}>
                      <Package className="h-2.5 w-2.5" />
                      {fmt(stock)} un
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function ProductHeader({
  product,
  step,
  total,
}: {
  product: Product;
  step: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
      {product.images?.[0] && (
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-12 h-12 rounded-lg object-cover border border-border/60 shrink-0 shadow-sm"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{product.name}</p>
        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{product.sku}</p>
      </div>
      <Badge variant="secondary" className="text-[10px]">
        {step + 1}/{total}
      </Badge>
    </div>
  );
}

/* ── Progress bar with glow ── */
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

/* ── Main Wizard ── */
export function BulkVariantWizard({ open, onOpenChange, products, mode, onComplete }: BulkVariantWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<BulkVariantSelection[]>([]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setSelections([]);
    }
  }, [open]);

  const handleSelect = useCallback(
    (variant: ExternalVariantStock | null) => {
      const product = products[currentIndex];
      const newSelections = [...selections, { product, variant }];

      if (currentIndex + 1 >= products.length) {
        onComplete(newSelections);
        onOpenChange(false);
      } else {
        setSelections(newSelections);
        setCurrentIndex((i) => i + 1);
      }
    },
    [currentIndex, products, selections, onComplete, onOpenChange],
  );

  const handleSkip = useCallback(() => {
    handleSelect(null);
  }, [handleSelect]);

  const currentProduct = products[currentIndex];
  if (!currentProduct) return null;

  const modeConfig: Record<BulkWizardMode, { icon: typeof ShoppingBag; title: string; colorClass: string; bgClass: string }> = {
    cart: { icon: ShoppingBag, title: 'Adicionar ao Carrinho', colorClass: 'text-primary', bgClass: 'bg-primary/15' },
    quote: { icon: FileText, title: 'Enviar para Orçamento', colorClass: 'text-success', bgClass: 'bg-success/15' },
    favorite: { icon: Heart, title: 'Favoritar com Cor', colorClass: 'text-destructive', bgClass: 'bg-destructive/15' },
    compare: { icon: GitCompare, title: 'Comparar com Cor', colorClass: 'text-primary', bgClass: 'bg-primary/15' },
    collection: { icon: FolderPlus, title: 'Coleção com Cor', colorClass: 'text-info', bgClass: 'bg-info/15' },
  };
  const { icon: Icon, title, colorClass } = modeConfig[mode];
  const bgClass = modeConfig[mode].bgClass;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 space-y-3">
          <DialogHeader className="p-0">
            <DialogTitle className="flex items-center gap-2.5 text-base font-display font-semibold">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                bgClass,
              )}>
                <Icon className={cn('h-4 w-4', colorClass)} />
              </div>
              {title}
              <Badge variant="secondary" className="ml-auto text-[10px] font-medium tabular-nums">
                {products.length} produto{products.length > 1 ? 's' : ''}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <ProgressBar current={currentIndex} total={products.length} />

          <p className="text-xs text-muted-foreground leading-relaxed">
            Escolha a cor/variação de cada produto. Clique em "Sem cor específica" para pular.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <AnimatePresence mode="wait">
            <ProductVariantStep
              key={currentProduct.id}
              product={currentProduct}
              onSelect={handleSelect}
              onSkip={handleSkip}
              stepIndex={currentIndex}
              totalSteps={products.length}
            />
          </AnimatePresence>
        </div>

        {/* Bottom step indicator */}
        <div className="px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Produto <strong className="text-foreground">{currentIndex + 1}</strong> de <strong className="text-foreground">{products.length}</strong>
          </span>
          <div className="flex gap-1">
            {products.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all duration-300',
                  i < currentIndex ? 'bg-primary' :
                  i === currentIndex ? 'bg-primary w-4' :
                  'bg-muted-foreground/20',
                )}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

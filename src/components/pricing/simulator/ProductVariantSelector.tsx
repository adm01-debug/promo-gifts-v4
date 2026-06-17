import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Palette, Check, Ruler } from 'lucide-react';

export interface ProductVariant {
  code: string;
  name: string;
  hex?: string;
  stock?: number;
  size_code?: string | null;
  sale_price?: number | null;
}

interface ProductVariantSelectorProps {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onSelect: (variant: ProductVariant | null) => void;
  label?: string;
}

// Smart size ordering
const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', '2XG', '3XG', 'EG', 'EGG'];
function sizeSort(a: string, b: string): number {
  const ia = SIZE_ORDER.indexOf(a.toUpperCase());
  const ib = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, 'pt-BR');
}

export function ProductVariantSelector({
  variants,
  selectedVariant,
  onSelect,
  label = 'Cor do Produto',
}: ProductVariantSelectorProps) {
  // Detect if any variant has size_code
  const hasSizes = useMemo(() => variants.some((v) => v.size_code), [variants]);

  // Group by color when sizes exist
  const grouped = useMemo(() => {
    if (!hasSizes) return null;
    const map = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      const key = v.name || 'Padrão';
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(v);
    }
    // Sort sizes within each group
    for (const [, group] of map) {
      group.sort((a, b) => sizeSort(a.size_code ?? '', b.size_code ?? ''));
    }
    return map;
  }, [variants, hasSizes]);

  const sortedVariants = useMemo(() => {
    if (hasSizes) return variants; // grouped view handles display
    return [...variants].sort((a, b) => {
      const aStock = a.stock ?? 0;
      const bStock = b.stock ?? 0;
      if (aStock > 0 && bStock === 0) return -1;
      if (aStock === 0 && bStock > 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [variants, hasSizes]);

  if (!variants || variants.length === 0) return null;

  // Single variant — just show info
  if (variants.length === 1 && !hasSizes) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
        <div
          className="h-6 w-6 rounded-full border-2 border-border"
          style={{ backgroundColor: variants[0].hex || '#888' }}
        />
        <span className="text-sm">
          Cor: <strong>{variants[0].name}</strong>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {label && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <Palette className="h-4 w-4 text-primary" />
          {label}
        </label>
      )}

      {/* ── Grouped by color with size chips ── */}
      {hasSizes && grouped ? (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([colorName, group]) => {
            const hex = group[0]?.hex;
            const anySelected = group.some((v) => selectedVariant?.code === v.code);

            return (
              <div
                key={colorName}
                className={cn(
                  'space-y-2 rounded-lg border p-3 transition-colors',
                  anySelected ? 'border-primary/40 bg-primary/5' : 'border-border',
                )}
              >
                {/* Color header */}
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'h-5 w-5 shrink-0 rounded-full border-2',
                      anySelected ? 'border-primary' : 'border-muted-foreground/30',
                    )}
                    style={{ backgroundColor: hex || '#888' }}
                  />
                  <span className="text-sm font-medium">{colorName}</span>
                </div>

                {/* Size chips */}
                <div className="flex flex-wrap gap-1.5 pl-7">
                  {group.map((variant) => {
                    const isSelected = selectedVariant?.code === variant.code;
                    const isOutOfStock = (variant.stock ?? 1) === 0;

                    return (
                      <button
                        key={variant.code}
                        onClick={() => onSelect(isSelected ? null : variant)}
                        disabled={isOutOfStock}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all',
                          isSelected
                            ? 'border-primary bg-primary/15 text-primary ring-1 ring-primary/30'
                            : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent',
                          isOutOfStock && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        <Ruler className="h-3 w-3" />
                        {variant.size_code || '—'}
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Flat color list (no sizes) ── */
        <div className="flex flex-wrap gap-2">
          {sortedVariants.map((variant) => {
            const isSelected = selectedVariant?.code === variant.code;
            const isOutOfStock = (variant.stock ?? 1) === 0;

            return (
              <button
                key={variant.code}
                onClick={() => onSelect(isSelected ? null : variant)}
                disabled={isOutOfStock}
                className={cn(
                  'group relative flex items-center gap-2 rounded-lg border px-3 py-2 transition-all',
                  isSelected
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-accent',
                  isOutOfStock && 'cursor-not-allowed opacity-50',
                )}
              >
                <div
                  className={cn(
                    'h-5 w-5 rounded-full border-2 transition-all',
                    isSelected ? 'border-primary' : 'border-muted-foreground/30',
                  )}
                  style={{ backgroundColor: variant.hex || '#888' }}
                >
                  {isSelected && (
                    <Check className="absolute left-[14px] top-1/2 h-3 w-3 -translate-y-1/2 text-primary-foreground" />
                  )}
                </div>

                <span className="text-sm font-medium">{variant.name}</span>

                {isOutOfStock && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                    Estoque zerado
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Selection summary */}
      {selectedVariant && (
        <p className="text-xs text-muted-foreground">
          Selecionado: <strong>{selectedVariant.name}</strong>
          {selectedVariant.size_code && (
            <span className="ml-1">
              — Tamanho: <strong>{selectedVariant.size_code}</strong>
            </span>
          )}
          {selectedVariant.stock !== undefined && selectedVariant.stock > 0 && (
            <span className="ml-2 text-success">({selectedVariant.stock} em estoque)</span>
          )}
        </p>
      )}
    </div>
  );
}

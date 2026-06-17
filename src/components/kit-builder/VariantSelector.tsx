/**
 * Variant Selector for replaceable kit items (G9)
 * Fetches allowed variants and lets the user swap color/variant for an item.
 * Shows size_code when available, grouping by color with size sub-options.
 */

import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Check, Loader2, Palette, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface VariantOption {
  id: string;
  color_name: string | null;
  color_hex: string | null;
  color_code: string | null;
  sku: string | null;
  selected_thumbnail: string | null;
  size_code?: string | null;
}

export interface VariantSelectionData {
  color: { name: string; hex?: string };
  size?: string;
  sku?: string;
  imageUrl?: string | null;
  price?: number;
}

interface VariantSelectorProps {
  itemId: string;
  itemName: string;
  allowedVariantIds: string[];
  selectedColor?: { name: string; hex?: string };
  selectedSize?: string;
  onSelectVariant: (itemId: string, data: VariantSelectionData) => void;
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

export function VariantSelector({
  itemId,
  allowedVariantIds,
  selectedColor,
  selectedSize,
  onSelectVariant,
}: VariantSelectorProps) {
  const [open, setOpen] = useState(false);

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['kit-variant-options', itemId, allowedVariantIds],
    queryFn: async () => {
      if (!allowedVariantIds.length) return [];

      const result = await dbInvoke<VariantOption>({
        table: 'product_variants',
        operation: 'select',
        select: 'id, color_name, color_hex, color_code, sku, selected_thumbnail, size_code',
        filters: { id: allowedVariantIds, is_active: true },
        limit: 50,
      });

      return result.records.filter((v) => v.color_name);
    },
    enabled: open && allowedVariantIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  // Detect if any variant has size_code
  const hasSizes = useMemo(() => variants.some((v) => v.size_code), [variants]);

  // Group by color when sizes exist
  const grouped = useMemo(() => {
    if (!hasSizes) return null;
    const map = new Map<string, VariantOption[]>();
    for (const v of variants) {
      const key = v.color_name || 'Padrão';
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(v);
    }
    // Sort sizes within each group
    for (const [, group] of map) {
      group.sort((a, b) => sizeSort(a.size_code ?? '', b.size_code ?? ''));
    }
    return map;
  }, [variants, hasSizes]);

  if (!allowedVariantIds.length) return null;

  const triggerLabel = () => {
    if (selectedColor) {
      return (
        <>
          {selectedColor.hex && (
            <span
              className="inline-block h-3 w-3 rounded-full border border-border"
              style={{ backgroundColor: selectedColor.hex }}
            />
          )}
          <span className="truncate">{selectedColor.name}</span>
          {selectedSize && (
            <Badge variant="outline" className="h-4 px-1 py-0 text-[9px] font-medium">
              {selectedSize}
            </Badge>
          )}
        </>
      );
    }
    return (
      <>
        <RefreshCw className="h-3 w-3" />
        Trocar
      </>
    );
  };

  const handleSelect = (variant: VariantOption) => {
    onSelectVariant(itemId, {
      color: {
        name: variant.color_name || 'Padrão',
        hex: variant.color_hex || undefined,
      },
      size: variant.size_code || undefined,
      sku: variant.sku || undefined,
      imageUrl: variant.selected_thumbnail || undefined,
      price: undefined,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 max-w-[180px] gap-1 px-2 text-xs">
          {triggerLabel()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
          {hasSizes ? 'Cor e Tamanho' : 'Variantes disponíveis'}
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : variants.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Nenhuma variante encontrada
          </p>
        ) : hasSizes && grouped ? (
          /* ── Grouped view: Color → Sizes ── */
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {Array.from(grouped.entries()).map(([colorName, group]) => {
              const hex = group[0]?.color_hex;
              return (
                <div key={colorName} className="space-y-1">
                  {/* Color header */}
                  <div className="flex items-center gap-2 px-1">
                    {hex ? (
                      <span
                        className="h-3.5 w-3.5 flex-shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: hex }}
                      />
                    ) : (
                      <Palette className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium">{colorName}</span>
                  </div>
                  {/* Size chips */}
                  <div className="flex flex-wrap gap-1 pl-6">
                    {group.map((variant) => {
                      const isActive =
                        selectedColor?.name === variant.color_name &&
                        selectedSize === variant.size_code;
                      return (
                        <button
                          key={variant.id}
                          className={cn(
                            'rounded-md border px-2 py-1 text-xs transition-colors',
                            'hover:border-primary/40 hover:bg-accent',
                            isActive
                              ? 'border-primary/40 bg-primary/10 font-medium text-primary'
                              : 'border-border text-foreground',
                          )}
                          onClick={() => handleSelect(variant)}
                        >
                          <span className="flex items-center gap-1">
                            <Ruler className="h-3 w-3" />
                            {variant.size_code || '—'}
                            {isActive && <Check className="h-3 w-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Flat list (no sizes) ── */
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {variants.map((variant) => {
              const isActive = selectedColor?.name === variant.color_name;
              return (
                <button
                  key={variant.id}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    'hover:bg-accent',
                    isActive && 'bg-primary/10 text-primary',
                  )}
                  onClick={() => handleSelect(variant)}
                >
                  {variant.color_hex ? (
                    <span
                      className="h-4 w-4 flex-shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: variant.color_hex }}
                    />
                  ) : (
                    <Palette className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate">{variant.color_name || 'Padrão'}</span>
                  {variant.sku && (
                    <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">
                      {variant.sku}
                    </span>
                  )}
                  {isActive && <Check className="h-3 w-3 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

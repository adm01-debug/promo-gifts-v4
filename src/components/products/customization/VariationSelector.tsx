/**
 * VariationSelector — Etapa 3: Escolha da variação (tabela de preço específica)
 *
 * Mostra as variações disponíveis para um grupo de técnica.
 * Cada variação = 1 product_print_area com seu customization_price_table_id.
 * Se só houver 1 variação, auto-seleciona E mostra o nome como confirmação.
 */

import { useEffect } from 'react';
import { Check, Maximize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PrintAreaV2 } from '@/hooks/simulation';

interface VariationSelectorProps {
  variations: PrintAreaV2[];
  selectedAreaId: string | null;
  onSelect: (areaId: string) => void;
}

export function VariationSelector({
  variations,
  selectedAreaId,
  onSelect,
}: VariationSelectorProps) {
  // Auto-select if only 1 variation
  useEffect(() => {
    if (variations.length === 1 && !selectedAreaId) {
      onSelect(variations[0].area_id);
    }
  }, [variations, selectedAreaId, onSelect]);

  // Single variation: show as confirmed selection (not hidden)
  if (variations.length === 1) {
    const area = variations[0];
    const isSelected = selectedAreaId === area.area_id;
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Etapa 3 · Variação
        </p>
        <div
          className={cn(
            'flex items-center justify-between rounded-lg border p-3',
            isSelected ? 'border-primary/40 bg-primary/10' : 'border-border/50 bg-secondary/50',
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground">
              <Check className="h-3 w-3" />
            </div>
            <span className="text-sm font-medium text-foreground">
              {area.technique_name || area.area_name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Maximize2 className="h-3 w-3" />
              até {area.max_width}×{area.max_height}cm
            </span>
            <Badge variant="outline" className="h-5 text-[10px]">
              única opção
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  // Multiple variations: show selector
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Etapa 3 · Escolha a variação
      </p>
      <div className="space-y-1.5">
        {variations.map((area) => {
          const isSelected = selectedAreaId === area.area_id;
          const variationName = area.technique_name || area.area_name;

          return (
            <button
              key={area.area_id}
              className={cn(
                'flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all duration-200',
                isSelected
                  ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20'
                  : 'border-border/50 bg-secondary/50 hover:border-border hover:bg-secondary/80',
              )}
              onClick={() => onSelect(area.area_id)}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/40',
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <span className="text-sm font-medium text-foreground">{variationName}</span>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Maximize2 className="h-3 w-3" />
                até {area.max_width}×{area.max_height}cm
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

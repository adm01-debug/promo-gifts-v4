/**
 * ProductVariations — exibe variantes (cores/tamanhos) do produto em formato de chip selecionável.
 */
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ProductVariation {
  id: string;
  label: string;
  hex?: string | null;
  available?: boolean;
}

interface ProductVariationsProps {
  variations: ProductVariation[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

export function ProductVariations({
  variations,
  selectedId,
  onSelect,
  className,
}: ProductVariationsProps) {
  if (!variations.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {variations.map((v) => {
        const selected = v.id === selectedId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect?.(v.id)}
            disabled={v.available === false}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition',
              selected
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border hover:border-primary/50',
              v.available === false && 'cursor-not-allowed opacity-40',
            )}
            aria-pressed={selected}
          >
            {v.hex && (
              <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: v.hex }} />
            )}
            <span>{v.label}</span>
            {v.available === false && (
              <Badge variant="outline" className="ml-1 text-[10px]">
                Indisp.
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

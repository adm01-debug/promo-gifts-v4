import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { SegmentoComplete } from '@/types/ramo-atividade';

interface SegmentoCheckboxProps {
  segmento: SegmentoComplete;
  isSelected: boolean;
  onToggle: (segmentoSlug: string) => void;
  ramoHexCode?: string | null;
  compact?: boolean;
}

export function SegmentoCheckbox({
  segmento,
  isSelected,
  onToggle,
  compact = false,
}: SegmentoCheckboxProps) {
  if (compact) {
    return (
      <label
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors',
          isSelected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/50',
        )}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle(segmento.segmento_slug)}
          className="h-3.5 w-3.5"
        />
        <span className="flex-1 truncate text-xs">{segmento.segmento_name}</span>
      </label>
    );
  }

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200',
        isSelected
          ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
          : 'text-foreground hover:bg-muted/50',
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(segmento.segmento_slug)}
        className={cn('h-4 w-4 transition-all', isSelected && 'border-primary bg-primary')}
      />

      <div className="min-w-0 flex-1">
        <span className={cn('text-sm', isSelected && 'font-medium')}>{segmento.segmento_name}</span>

        {segmento.segmento_description && (
          <p className="truncate text-xs text-muted-foreground">{segmento.segmento_description}</p>
        )}
      </div>
    </label>
  );
}

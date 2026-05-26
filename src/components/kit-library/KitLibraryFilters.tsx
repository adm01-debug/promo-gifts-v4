/**
 * Filtros visuais para a Biblioteca de Kits — chips por tag/cor + ordenação.
 */
import { ArrowUpDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type SortOption = 'recent' | 'price-desc' | 'name-asc' | 'usage-desc' | 'last-used';

export const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Mais recentes',
  'price-desc': 'Maior valor',
  'name-asc': 'Nome (A-Z)',
  'usage-desc': 'Mais usados',
  'last-used': 'Usados recentemente',
};

interface Props {
  tags: string[];
  colors: string[];
  selectedTag: string | null;
  selectedColor: string | null;
  sort: SortOption;
  onTagChange: (tag: string | null) => void;
  onColorChange: (color: string | null) => void;
  onSortChange: (s: SortOption) => void;
  showUsageSort?: boolean;
  showLastUsedSort?: boolean;
}

export function KitLibraryFilters({
  tags,
  colors,
  selectedTag,
  selectedColor,
  sort,
  onTagChange,
  onColorChange,
  onSortChange,
  showUsageSort,
  showLastUsedSort,
}: Props) {
  const hasFilters = !!selectedTag || !!selectedColor;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.slice(0, 8).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTagChange(selectedTag === t ? null : t)}
              className={cn('transition-colors')}
              aria-pressed={selectedTag === t}
            >
              <Badge
                variant={selectedTag === t ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-primary/10"
              >
                {t}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Color dots */}
      {colors.length > 0 && (
        <div className="flex items-center gap-1.5 border-l border-border/60 px-2">
          {colors.slice(0, 8).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(selectedColor === c ? null : c)}
              aria-label={`Filtrar por cor ${c}`}
              className={cn(
                'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                selectedColor === c ? 'border-foreground ring-2 ring-primary/30' : 'border-border',
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onTagChange(null);
            onColorChange(null);
          }}
          className="h-7 gap-1 text-xs"
        >
          <X className="h-3 w-3" /> Limpar
        </Button>
      )}

      {/* Sort */}
      <div className="ml-auto flex items-center gap-1.5">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
          <SelectTrigger className="h-9 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">{SORT_LABELS['recent']}</SelectItem>
            {showLastUsedSort && (
              <SelectItem value="last-used">{SORT_LABELS['last-used']}</SelectItem>
            )}
            <SelectItem value="price-desc">{SORT_LABELS['price-desc']}</SelectItem>
            <SelectItem value="name-asc">{SORT_LABELS['name-asc']}</SelectItem>
            {showUsageSort && (
              <SelectItem value="usage-desc">{SORT_LABELS['usage-desc']}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

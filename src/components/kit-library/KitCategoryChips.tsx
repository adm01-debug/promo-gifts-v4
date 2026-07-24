/**
 * KitCategoryChips — Chips de categoria para a aba Sugeridos.
 */
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  categories: string[];
  selected: string | null;
  onSelect: (cat: string | null) => void;
}

export function KitCategoryChips({ categories, selected, onSelect }: Props) {
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant={selected === null ? 'default' : 'outline'}
        className="h-7 px-3 text-xs"
        onClick={() => onSelect(null)}
      >
        Todas
      </Button>
      {categories.map((cat) => (
        <Button
          key={cat}
          size="sm"
          variant={selected === cat ? 'default' : 'outline'}
          className={cn('h-7 px-3 text-xs', selected === cat && 'shadow-sm')}
          onClick={() => onSelect(selected === cat ? null : cat)}
        >
          {cat}
        </Button>
      ))}
    </div>
  );
}

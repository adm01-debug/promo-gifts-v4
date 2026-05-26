import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FavoritesSort =
  | 'recent'
  | 'oldest'
  | 'price-asc'
  | 'price-desc'
  | 'name-asc'
  | 'name-desc'
  | 'category';

const LABELS: Record<FavoritesSort, string> = {
  recent: 'Recém-adicionados',
  oldest: 'Mais antigos',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  'name-asc': 'Nome (A→Z)',
  'name-desc': 'Nome (Z→A)',
  category: 'Categoria',
};

interface Props {
  value: FavoritesSort;
  onChange: (s: FavoritesSort) => void;
  /** Filtro: mostrar apenas items com queda de preço */
  onlyPriceDrops?: boolean;
  onTogglePriceDrops?: (v: boolean) => void;
  /** Quantidade de items com queda — exibido como counter no chip. null oculta o chip */
  priceDropCount?: number | null;
}

export function FavoritesSortBar({
  value,
  onChange,
  onlyPriceDrops = false,
  onTogglePriceDrops,
  priceDropCount,
}: Props) {
  const showDropChip =
    onTogglePriceDrops &&
    (priceDropCount === null || priceDropCount === undefined || priceDropCount > 0);

  return (
    <div className="flex items-center gap-1.5">
      {showDropChip && (
        <Button
          variant={onlyPriceDrops ? 'default' : 'outline'}
          size="sm"
          onClick={() => onTogglePriceDrops?.(!onlyPriceDrops)}
          className={cn(
            'h-8 gap-1.5 text-xs transition-all',
            onlyPriceDrops && 'bg-success text-success-foreground hover:bg-success/90',
          )}
          aria-pressed={onlyPriceDrops}
          title={onlyPriceDrops ? 'Mostrar todos' : 'Filtrar items com queda de preço'}
        >
          <TrendingDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Quedas</span>
          {typeof priceDropCount === 'number' && priceDropCount > 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                onlyPriceDrops
                  ? 'bg-success-foreground/20 text-success-foreground'
                  : 'bg-success/20 text-success',
              )}
            >
              {priceDropCount}
            </span>
          )}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="hidden text-xs sm:inline">{LABELS[value]}</span>
            <span className="text-xs sm:hidden">Ordenar</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
            Ordenação
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as FavoritesSort)}>
            {(Object.keys(LABELS) as FavoritesSort[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className="text-xs">
                {LABELS[k]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

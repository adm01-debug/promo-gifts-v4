/**
 * CartTablePreferences — Popover para customizar colunas visíveis e densidade
 * da tabela do carrinho. Preferências persistidas em localStorage.
 */
import { Columns3, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type CartTableColumnKey = 'actions' | 'color' | 'price' | 'quantity' | 'total';
export type CartTableDensity = 'comfortable' | 'compact';

export const ALL_COLUMNS: { key: CartTableColumnKey; label: string; required?: boolean }[] = [
  { key: 'color', label: 'Cor' },
  { key: 'quantity', label: 'Quantidade', required: true },
  { key: 'price', label: 'Preço unitário' },
  { key: 'total', label: 'Total' },
  { key: 'actions', label: 'Ações', required: true },
];

interface Props {
  visibleColumns: Record<CartTableColumnKey, boolean>;
  setVisibleColumns: (next: Record<CartTableColumnKey, boolean>) => void;
  density: CartTableDensity;
  setDensity: (d: CartTableDensity) => void;
}

export function CartTablePreferences({
  visibleColumns,
  setVisibleColumns,
  density,
  setDensity,
}: Props) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 bg-card/40 backdrop-blur-sm sm:h-9"
                aria-label="Customizar colunas e densidade"
                data-testid="cart-table-prefs-trigger"
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span className="hidden text-xs sm:inline">Colunas</span>
              </Button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>Colunas visíveis e densidade da tabela</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 border-primary/10 p-4 shadow-2xl" sideOffset={8}>
        <div className="space-y-4">
          <div>
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Colunas visíveis
            </p>
            <div className="space-y-2">
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/40',
                    col.required && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <Checkbox
                    checked={visibleColumns[col.key]}
                    disabled={col.required}
                    onCheckedChange={(checked) =>
                      setVisibleColumns({ ...visibleColumns, [col.key]: Boolean(checked) })
                    }
                    data-testid={`cart-col-toggle-${col.key}`}
                  />
                  <span>{col.label}</span>
                  {col.required && (
                    <span className="ml-auto text-[10px] uppercase text-muted-foreground/60">
                      Fixo
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
          <Separator className="opacity-50" />
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Rows3 className="h-3 w-3" /> Densidade
            </p>
            <div className="flex items-center gap-0.5 rounded-xl border border-border/40 bg-muted/60 p-1">
              {(['compact', 'comfortable'] as CartTableDensity[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={density === d}
                  onClick={() => setDensity(d)}
                  data-testid={`cart-density-${d}`}
                  className={cn(
                    'flex h-8 flex-1 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition-all',
                    density === d
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background/50 hover:text-foreground',
                  )}
                >
                  {d === 'compact' ? 'Compacta' : 'Confortável'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

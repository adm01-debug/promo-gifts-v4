/**
 * WidgetFiltersBar — barra compacta de filtros usada nos widgets do dashboard
 * (Minhas Propostas, Meus Pedidos, Solicitações de Desconto).
 *
 * Provê: busca textual, seleção de status (multi via Select com "Todos") e
 * intervalo de datas (DateRange popover). Tudo controlado pelo pai.
 */
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Search, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface WidgetFiltersValue {
  search: string;
  status: string; // "all" ou um valor da lista
  dateRange?: DateRange;
}

export interface WidgetStatusOption {
  value: string;
  label: string;
}

interface Props {
  value: WidgetFiltersValue;
  onChange: (next: WidgetFiltersValue) => void;
  statusOptions: WidgetStatusOption[];
  searchPlaceholder?: string;
  /** Texto exibido como item "Todos" no Select de status. */
  allStatusLabel?: string;
  /** Quando false, oculta o seletor de intervalo de datas. Default: true. */
  showDateRange?: boolean;
}

export const EMPTY_FILTERS: WidgetFiltersValue = {
  search: '',
  status: 'all',
  dateRange: undefined,
};

export function WidgetFiltersBar({
  value,
  onChange,
  statusOptions,
  searchPlaceholder = 'Buscar…',
  allStatusLabel = 'Todos os status',
  showDateRange = true,
}: Props) {
  const [open, setOpen] = useState(false);

  const dateLabel = useMemo(() => {
    const r = value.dateRange;
    if (!r?.from) return 'Período';
    if (r.to) return `${format(r.from, 'dd/MM')} – ${format(r.to, 'dd/MM')}`;
    return format(r.from, 'dd/MM/yyyy');
  }, [value.dateRange]);

  const hasAnyFilter =
    value.search.trim().length > 0 || value.status !== 'all' || !!value.dateRange?.from;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="relative min-w-[140px] flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder={searchPlaceholder}
          className="h-8 pl-7 text-xs"
        />
      </div>

      <Select value={value.status} onValueChange={(s) => onChange({ ...value, status: s })}>
        <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs">
          <SelectValue placeholder={allStatusLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allStatusLabel}</SelectItem>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showDateRange && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 gap-1.5 px-2 text-xs font-normal',
                !value.dateRange?.from && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={value.dateRange}
              onSelect={(r) => onChange({ ...value, dateRange: r })}
              locale={ptBR}
              initialFocus
              className={cn('pointer-events-auto p-3')}
            />
          </PopoverContent>
        </Popover>
      )}

      {hasAnyFilter && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          onClick={() => onChange(EMPTY_FILTERS)}
          title="Limpar filtros"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/**
 * Helpers compartilhados para aplicar filtros sobre listas em memória.
 */
export function withinDateRange(iso: string | null | undefined, range?: DateRange): boolean {
  if (!range?.from) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const from = new Date(range.from).setHours(0, 0, 0, 0);
  const to = range.to
    ? new Date(range.to).setHours(23, 59, 59, 999)
    : new Date(range.from).setHours(23, 59, 59, 999);
  return t >= from && t <= to;
}

export function matchesSearch(
  haystacks: Array<string | null | undefined>,
  search: string,
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return haystacks.some((h) => (h ?? '').toLowerCase().includes(q));
}

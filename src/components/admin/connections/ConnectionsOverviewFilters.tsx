import {
  Database,
  Briefcase,
  Workflow,
  Plug,
  Webhook,
  Filter as FilterIcon,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CONSECUTIVE_FAILURE_THRESHOLD } from '@/lib/connections-config';
import type {
  OverviewFilters,
  OverviewStatusFilter,
  OverviewWindowFilter,
} from '@/hooks/intelligence';

const TYPE_OPTIONS: Array<{ value: string; label: string; icon: typeof Database }> = [
  { value: 'supabase', label: 'Supabase', icon: Database },
  { value: 'bitrix24', label: 'Bitrix24', icon: Briefcase },
  { value: 'n8n', label: 'n8n', icon: Workflow },
  { value: 'mcp', label: 'MCP', icon: Plug },
  { value: 'webhook_outbound', label: 'Webhook Outbound', icon: Webhook },
];

const STATUS_OPTIONS: Array<{ value: OverviewStatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'ok', label: 'OK' },
  { value: 'fail', label: 'Falha' },
];

const WINDOW_OPTIONS: Array<{ value: OverviewWindowFilter; label: string }> = [
  { value: 'any', label: 'Qualquer momento' },
  { value: '5m', label: 'Últimos 5 min' },
  { value: '1h', label: 'Última hora' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: 'never', label: 'Nunca testado' },
];

interface Props {
  filters: OverviewFilters;
  toggleType: (type: string) => void;
  setStatus: (status: OverviewStatusFilter) => void;
  setWindow: (w: OverviewWindowFilter) => void;
  removeType: (type: string) => void;
  setOnlyConsecutiveFailures: (value: boolean) => void;
  reset: () => void;
  activeCount: number;
  totalCount: number;
  filteredCount: number;
}

function typeLabel(value: string): string {
  return TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function windowLabel(value: OverviewWindowFilter): string {
  return WINDOW_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function ConnectionsOverviewFilters({
  filters,
  toggleType,
  setStatus,
  setWindow,
  removeType,
  setOnlyConsecutiveFailures,
  reset,
  activeCount,
  totalCount,
  filteredCount,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Type multi-select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              aria-label="Filtrar por tipo de conexão"
            >
              <FilterIcon className="h-3.5 w-3.5" />
              Tipo
              {filters.types.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {filters.types.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div className="space-y-1">
              {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
                const checked = filters.types.includes(value);
                return (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleType(value)}
                      aria-label={`Filtrar por ${label}`}
                    />
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">{label}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Status segmented */}
        <div
          className="inline-flex items-center rounded-md border bg-background p-0.5"
          role="radiogroup"
          aria-label="Filtrar por status do último teste"
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="radio"
              aria-checked={filters.status === opt.value}
              onClick={() => setStatus(opt.value)}
              className={cn(
                'h-8 rounded-sm px-3 text-xs font-medium transition-colors',
                filters.status === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Window select */}
        <Select value={filters.window} onValueChange={(v) => setWindow(v as OverviewWindowFilter)}>
          <SelectTrigger
            className="h-9 w-[180px]"
            aria-label="Filtrar por janela da última verificação"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Only consecutive failures toggle */}
        <button
          type="button"
          onClick={() => setOnlyConsecutiveFailures(!filters.onlyConsecutiveFailures)}
          aria-pressed={filters.onlyConsecutiveFailures}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
            filters.onlyConsecutiveFailures
              ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
              : 'bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Apenas com falhas seguidas
          <span className="text-[10px] opacity-70">≥{CONSECUTIVE_FAILURE_THRESHOLD}</span>
        </button>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {filteredCount} de {totalCount} {totalCount === 1 ? 'conexão' : 'conexões'}
          </span>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={reset}>
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.types.map((t) => (
            <button
              key={t}
              onClick={() => removeType(t)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  e.preventDefault();
                  removeType(t);
                }
              }}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label={`Remover filtro ${typeLabel(t)}`}
            >
              {typeLabel(t)}
              <X className="h-3 w-3" />
            </button>
          ))}
          {filters.status !== 'all' && (
            <button
              onClick={() => setStatus('all')}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  e.preventDefault();
                  setStatus('all');
                }
              }}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Remover filtro de status"
            >
              Status: {filters.status === 'ok' ? 'OK' : 'Falha'}
              <X className="h-3 w-3" />
            </button>
          )}
          {filters.window !== 'any' && (
            <button
              onClick={() => setWindow('any')}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  e.preventDefault();
                  setWindow('any');
                }
              }}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Remover filtro de janela"
            >
              {windowLabel(filters.window)}
              <X className="h-3 w-3" />
            </button>
          )}
          {filters.onlyConsecutiveFailures && (
            <button
              onClick={() => setOnlyConsecutiveFailures(false)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  e.preventDefault();
                  setOnlyConsecutiveFailures(false);
                }
              }}
              className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs text-destructive transition-colors hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive/40"
              aria-label="Remover filtro de falhas consecutivas"
            >
              ≥{CONSECUTIVE_FAILURE_THRESHOLD} falhas seguidas
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

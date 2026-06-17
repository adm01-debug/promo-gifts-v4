import { useState, useMemo } from 'react';
import {
  Truck,
  Search,
  Calendar,
  Package,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  X,
  TrendingUp,
  AlertCircle,
  CalendarDays,
  Boxes,
  MapPin,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { FutureStockEntry } from '@/types/stock';

interface FutureStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: FutureStockEntry[];
}

const STATUS_SORT_ORDER: Record<string, number> = {
  confirmed: 0,
  in_transit: 1,
  pending: 2,
  partial: 3,
} as const;

type SortField = 'date' | 'quantity' | 'product' | 'status';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'confirmed' | 'pending' | 'in_transit';
type DateRange = 'all' | '7d' | '15d' | '30d' | '60d' | '90d';
type ViewMode = 'list' | 'timeline';

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }
> = {
  confirmed: {
    label: 'Confirmado',
    color: 'text-success',
    bgColor: 'bg-success/10 border-success/20',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Pendente',
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/20',
    icon: Clock,
  },
  in_transit: {
    label: 'Em Trânsito',
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/20',
    icon: Truck,
  },
  partial: {
    label: 'Parcial',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50 border-border',
    icon: AlertCircle,
  },
};

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: 'Todas as datas',
  '7d': 'Próx. 7 dias',
  '15d': 'Próx. 15 dias',
  '30d': 'Próx. 30 dias',
  '60d': 'Próx. 60 dias',
  '90d': 'Próx. 90 dias',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDaysLabel(days: number): {
  text: string;
  urgency: 'ok' | 'soon' | 'imminent' | 'overdue';
} {
  if (days < 0) return { text: `${Math.abs(days)}d atrasado`, urgency: 'overdue' };
  if (days === 0) return { text: 'Hoje', urgency: 'imminent' };
  if (days <= 3) return { text: `${days}d`, urgency: 'imminent' };
  if (days <= 7) return { text: `${days}d`, urgency: 'soon' };
  return { text: `${days}d`, urgency: 'ok' };
}

function getWeekLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '⚠️ Atrasado';
  if (diffDays <= 7) return '📦 Esta Semana';
  if (diffDays <= 14) return '📅 Próxima Semana';
  if (diffDays <= 30) return '🗓️ Este Mês';
  if (diffDays <= 60) return '📆 Próximos 2 Meses';
  return '🔮 Longo Prazo';
}

const KPI_CARD_STYLES = {
  default: 'bg-muted/50 border-border',
  primary: 'bg-primary/5 border-primary/15',
  success: 'bg-success/5 border-success/15',
  warning: 'bg-warning/5 border-warning/15',
} as const;

const KPI_ICON_STYLES = {
  default: 'text-muted-foreground bg-muted/50',
  primary: 'text-primary bg-primary/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
} as const;

// ============================================
// KPI CARD
// ============================================
function KpiCard({
  label,
  value,
  sub,
  icon: iconComponent,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Package;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}) {
  const Icon = iconComponent;

  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-all hover:shadow-sm',
        KPI_CARD_STYLES[variant],
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            KPI_ICON_STYLES[variant],
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="text-xl font-bold tabular-nums">
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ============================================
// ENTRY ROW
// ============================================
function EntryRow({ entry }: { entry: FutureStockEntry }) {
  const days = daysUntil(entry.expectedDate);
  const daysInfo = getDaysLabel(days);
  const statusConf = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConf.icon;

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_90px_110px_100px_70px] gap-2 rounded-md border px-3 py-2.5 transition-all duration-200',
        'hover:bg-muted/40 hover:shadow-sm',
        daysInfo.urgency === 'overdue' && 'border-destructive/30 bg-destructive/5',
        daysInfo.urgency === 'imminent' && 'border-primary/30 bg-primary/5',
        daysInfo.urgency === 'soon' && 'border-warning/20 bg-warning/5',
        daysInfo.urgency === 'ok' && 'border-border',
      )}
    >
      {/* Product */}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={entry.productName}>
          {entry.productName || 'Produto'}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {entry.productSku && (
            <span className="rounded bg-muted/50 px-1 font-mono text-[10px] text-muted-foreground">
              {entry.productSku}
            </span>
          )}
          {entry.colorName && (
            <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px]">
              {entry.colorName}
            </Badge>
          )}
          {entry.supplierName && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" />
                    {entry.supplierName}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Fornecedor: {entry.supplierName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Quantity */}
      <div className="flex items-center">
        <span className="text-sm font-bold tabular-nums text-primary">
          +{entry.expectedQuantity.toLocaleString('pt-BR')}
        </span>
      </div>

      {/* Date */}
      <div className="flex flex-col justify-center">
        <span className="text-xs text-foreground">{formatDate(entry.expectedDate)}</span>
        {entry.orderDate && (
          <span className="text-[10px] text-muted-foreground">
            Pedido: {formatShortDate(entry.orderDate)}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center">
        <Badge
          variant="outline"
          className={cn('gap-1 px-1.5 py-0.5 text-[10px]', statusConf.bgColor, statusConf.color)}
        >
          <StatusIcon className="h-2.5 w-2.5" />
          {statusConf.label}
        </Badge>
      </div>

      {/* Days until */}
      <div className="flex items-center justify-end">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                  daysInfo.urgency === 'overdue' && 'bg-destructive/10 text-destructive',
                  daysInfo.urgency === 'imminent' && 'bg-primary/10 text-primary',
                  daysInfo.urgency === 'soon' && 'bg-warning/10 text-warning',
                  daysInfo.urgency === 'ok' && 'text-muted-foreground',
                )}
              >
                {daysInfo.text}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {days < 0
                  ? `Atrasado há ${Math.abs(days)} dia(s)`
                  : days === 0
                    ? 'Previsto para hoje'
                    : `Chega em ${days} dia(s) — ${formatDate(entry.expectedDate)}`}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// ============================================
// TIMELINE VIEW
// ============================================
function TimelineView({ entries }: { entries: FutureStockEntry[] }) {
  const grouped = useMemo(() => {
    const groups = new Map<string, FutureStockEntry[]>();
    for (const e of entries) {
      const label = getWeekLabel(e.expectedDate);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)?.push(e);
    }
    return Array.from(groups.entries());
  }, [entries]);

  return (
    <div className="space-y-4">
      {grouped.map(([label, groupEntries]) => {
        const totalQty = groupEntries.reduce((s, e) => s + e.expectedQuantity, 0);
        return (
          <div key={label}>
            <div className="sticky top-0 z-[1] mb-2 flex items-center justify-between bg-background/95 py-1 backdrop-blur-sm">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                {label}
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {groupEntries.length} {groupEntries.length === 1 ? 'reposição' : 'reposições'}
                </Badge>
              </h4>
              <span className="text-xs font-medium tabular-nums text-primary">
                +{totalQty.toLocaleString('pt-BR')} un.
              </span>
            </div>
            <div className="ml-2 space-y-1 border-l-2 border-primary/20 pl-2">
              {groupEntries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// MAIN DIALOG
// ============================================
export function FutureStockDialog({ open, onOpenChange, entries }: FutureStockDialogProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  const filtered = useMemo(() => {
    let items = [...entries];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          e.productName?.toLowerCase().includes(q) ||
          e.productSku?.toLowerCase().includes(q) ||
          e.colorName?.toLowerCase().includes(q) ||
          e.supplierName?.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== 'all') {
      items = items.filter((e) => e.status === statusFilter);
    }

    if (dateRange !== 'all') {
      const days = parseInt(dateRange);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + days);
      items = items.filter((e) => new Date(e.expectedDate) <= cutoff);
    }

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime();
          break;
        case 'quantity':
          cmp = a.expectedQuantity - b.expectedQuantity;
          break;
        case 'product':
          cmp = (a.productName || '').localeCompare(b.productName || '');
          break;
        case 'status': {
          cmp = (STATUS_SORT_ORDER[a.status] ?? 4) - (STATUS_SORT_ORDER[b.status] ?? 4);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return items;
  }, [entries, search, statusFilter, dateRange, sortField, sortDir]);

  // Summary stats
  const stats = useMemo(() => {
    const totalUnits = filtered.reduce((s, e) => s + e.expectedQuantity, 0);
    const confirmed = filtered.filter((e) => e.status === 'confirmed');
    const confirmedUnits = confirmed.reduce((s, e) => s + e.expectedQuantity, 0);
    const inTransit = filtered.filter((e) => e.status === 'in_transit');
    const inTransitUnits = inTransit.reduce((s, e) => s + e.expectedQuantity, 0);
    const uniqueProducts = new Set(filtered.map((e) => e.productId)).size;
    const overdue = filtered.filter((e) => daysUntil(e.expectedDate) < 0);
    const nextDate =
      filtered.length > 0
        ? filtered.reduce(
            (min, e) => (e.expectedDate < min ? e.expectedDate : min),
            filtered[0].expectedDate,
          )
        : null;
    return {
      totalUnits,
      confirmedUnits,
      inTransitUnits,
      uniqueProducts,
      nextDate,
      total: filtered.length,
      overdueCount: overdue.length,
    };
  }, [filtered]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const activeFilters =
    (statusFilter !== 'all' ? 1 : 0) + (dateRange !== 'all' ? 1 : 0) + (search ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Truck className="h-4 w-4 text-primary" />
            </div>
            Previsão de Reposição
            <Badge variant="secondary" className="ml-1 font-normal">
              {entries.length} previsões
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Planeje suas vendas com base nas reposições previstas — filtre por data, status ou
            produto.
          </DialogDescription>
        </DialogHeader>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <KpiCard
            label="Total Previsto"
            value={stats.totalUnits}
            sub={`${stats.total} reposições`}
            icon={Boxes}
            variant="primary"
          />
          <KpiCard
            label="Confirmado"
            value={stats.confirmedUnits}
            sub="unidades"
            icon={CheckCircle2}
            variant="success"
          />
          <KpiCard
            label="Em Trânsito"
            value={stats.inTransitUnits}
            sub="a caminho"
            icon={Truck}
            variant="primary"
          />
          <KpiCard
            label="Produtos"
            value={stats.uniqueProducts}
            sub="com reposição"
            icon={Package}
          />
          <KpiCard
            label="Próx. Chegada"
            value={stats.nextDate ? getDaysLabel(daysUntil(stats.nextDate)).text : '-'}
            sub={stats.nextDate ? formatDate(stats.nextDate) : 'sem previsão'}
            icon={CalendarDays}
            variant={stats.overdueCount > 0 ? 'warning' : 'default'}
          />
        </div>

        {/* Confirmation progress bar */}
        {stats.totalUnits > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Confirmação de Reposição</span>
              <span className="font-medium tabular-nums text-success">
                {Math.round((stats.confirmedUnits / stats.totalUnits) * 100)}% confirmado
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-l-full bg-success transition-all duration-500"
                style={{ width: `${(stats.confirmedUnits / stats.totalUnits) * 100}%` }}
              />
              <div
                className="h-full bg-primary/60 transition-all duration-500"
                style={{ width: `${(stats.inTransitUnits / stats.totalUnits) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-success" />
                Confirmado
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary/60" />
                Em trânsito
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-muted" />
                Pendente
              </span>
            </div>
          </div>
        )}

        {/* Overdue alert */}
        {stats.overdueCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              <strong>{stats.overdueCount}</strong>{' '}
              {stats.overdueCount === 1 ? 'reposição atrasada' : 'reposições atrasadas'} — verifique
              com o fornecedor.
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produto, SKU, cor ou fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="confirmed">✅ Confirmado</SelectItem>
              <SelectItem value="pending">⏳ Pendente</SelectItem>
              <SelectItem value="in_transit">🚚 Em Trânsito</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="h-9 w-[150px]">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DATE_RANGE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setViewMode('timeline')}
            >
              <CalendarDays className="mr-1 h-3.5 w-3.5" />
              Timeline
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setViewMode('list')}
            >
              <FileText className="mr-1 h-3.5 w-3.5" />
              Lista
            </Button>
          </div>

          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1 text-xs"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setDateRange('all');
              }}
            >
              <X className="h-3.5 w-3.5" /> Limpar ({activeFilters})
            </Button>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[45vh] flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                <Package className="h-8 w-8 opacity-40" />
              </div>
              <p className="mb-1 font-semibold text-foreground">Nenhuma reposição encontrada</p>
              <p className="max-w-xs text-center text-sm">
                {activeFilters > 0
                  ? 'Nenhum resultado para os filtros aplicados. Tente ajustar os critérios.'
                  : 'Não há reposições previstas no momento. Novas entradas aparecerão aqui quando registradas.'}
              </p>
              {activeFilters > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                    setDateRange('all');
                  }}
                >
                  <X className="h-3.5 w-3.5" /> Limpar filtros
                </Button>
              )}
            </div>
          ) : viewMode === 'timeline' ? (
            <TimelineView entries={filtered} />
          ) : (
            <div className="space-y-1">
              {/* List Header */}
              <div className="sticky top-0 z-[1] grid grid-cols-[1fr_90px_110px_100px_70px] gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                <button
                  type="button"
                  onClick={() => toggleSort('product')}
                  className="flex items-center gap-1 text-left transition-colors hover:text-foreground"
                >
                  Produto {sortField === 'product' && <ArrowUpDown className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort('quantity')}
                  className="flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  Qtd. {sortField === 'quantity' && <ArrowUpDown className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort('date')}
                  className="flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  Previsão {sortField === 'date' && <ArrowUpDown className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort('status')}
                  className="flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  Status {sortField === 'status' && <ArrowUpDown className="h-3 w-3" />}
                </button>
                <span className="text-right">Tempo</span>
              </div>
              {filtered.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer summary */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
            <span>
              {filtered.length === entries.length
                ? `${filtered.length} previsões`
                : `${filtered.length} de ${entries.length} previsões`}
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-success" />
              Total:{' '}
              <strong className="tabular-nums text-foreground">
                {stats.totalUnits.toLocaleString('pt-BR')} un.
              </strong>
              {stats.confirmedUnits > 0 && (
                <span className="ml-1 text-success">
                  ({Math.round((stats.confirmedUnits / stats.totalUnits) * 100)}% confirmado)
                </span>
              )}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

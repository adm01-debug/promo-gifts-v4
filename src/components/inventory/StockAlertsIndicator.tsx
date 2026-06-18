import { useState, forwardRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Loader2,
  X,
  ExternalLink,
  Sparkles,
  RefreshCw,
  TrendingDown,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  useStockNotificationCounts,
  useStockoutAlerts,
  useLowStockAlerts,
  useNoveltyAlerts,
  useRecentRestocks,
  type StockNotificationItem,
  type StockNotificationKind,
} from '@/hooks/products/useStockNotifications';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sino de ESTOQUE do header (`aria-label="Alertas de estoque"`).
 *
 * v2: filtro de período (Hoje / 7 dias / 30 dias / Tudo) + data do evento
 * por item ("Esgotado 15/06/2026"). Fontes de verdade e ACL em
 * docs/notifications-module-audit.md.
 */

// ─── Período ─────────────────────────────────────────────────────

type DatePeriod = 'today' | '7d' | '30d' | 'all';

const PERIODS: { key: DatePeriod; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'all', label: 'Tudo' },
];

/** Converte DatePeriod em string ISO 'YYYY-MM-DD' (ou null = sem filtro). */
function getSince(period: DatePeriod): string | null {
  if (period === 'all') return null;
  const d = new Date();
  if (period === '7d') d.setDate(d.getDate() - 7);
  else if (period === '30d') d.setDate(d.getDate() - 30);
  // 'today': d permanece como data atual
  return d.toISOString().split('T')[0];
}

/**
 * Formata a data do evento no padrão pt-BR (DD/MM/AAAA).
 * Strings date-only ('YYYY-MM-DD') são normalizadas com T12:00:00
 * para evitar drift de timezone.
 */
function formatEventDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const normalized = DATE_ONLY_RE.test(dateStr) ? `${dateStr}T12:00:00` : dateStr;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

// ─── Tab config ──────────────────────────────────────────────────

type TabKey = 'stockout' | 'low' | 'new' | 'restocked';

interface TabDef {
  key: TabKey;
  label: string;
  activeColor: string;
  route: string;
}

const TABS: TabDef[] = [
  {
    key: 'stockout',
    label: 'Zerou',
    activeColor: 'bg-destructive/10 text-destructive border-destructive',
    route: '/estoque',
  },
  {
    key: 'low',
    label: 'Baixo',
    activeColor: 'bg-warning/10 text-warning border-warning',
    route: '/estoque',
  },
  {
    key: 'new',
    label: 'Novidade',
    activeColor: 'bg-primary/10 text-primary border-primary',
    route: '/novidades',
  },
  {
    key: 'restocked',
    label: 'Chegou',
    activeColor: 'bg-success/10 text-success border-success',
    route: '/reposicao',
  },
];

// ─── Trigger ─────────────────────────────────────────────────────

interface TriggerProps extends React.ComponentPropsWithoutRef<typeof Button> {
  total: number;
  badgeColor: string;
  isLoading: boolean;
}

const NotificationTrigger = forwardRef<HTMLButtonElement, TriggerProps>(
  ({ total, badgeColor, isLoading, ...props }, ref) => (
    <Button
      ref={ref}
      {...props}
      variant="ghost"
      size="icon"
      className="relative h-8 w-8 rounded-full text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground"
      aria-label="Alertas de estoque"
      aria-busy={isLoading || undefined}
      data-testid="stock-alerts-indicator"
    >
      {isLoading ? (
        <Loader2 className="h-[17px] w-[17px] animate-spin opacity-60" />
      ) : (
        <Package className="h-[17px] w-[17px]" strokeWidth={1.75} />
      )}
      {!isLoading && total > 0 && (
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] animate-scale-in items-center justify-center rounded-full px-1 text-[9px] font-bold text-primary-foreground',
            badgeColor,
          )}
        >
          {total > 99 ? '99+' : total}
        </span>
      )}
    </Button>
  ),
);
NotificationTrigger.displayName = 'NotificationTrigger';

// ─── Item helpers ────────────────────────────────────────────────

function getKindBadge(kind: StockNotificationKind): JSX.Element {
  if (kind === 'stockout')
    return (
      <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
        Esgotado
      </Badge>
    );
  if (kind === 'low')
    return (
      <Badge className="bg-warning px-1.5 py-0 text-[10px] text-warning-foreground">Baixo</Badge>
    );
  if (kind === 'new')
    return (
      <Badge className="bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">Novo</Badge>
    );
  return (
    <Badge className="bg-success px-1.5 py-0 text-[10px] text-success-foreground">Reposto</Badge>
  );
}

function getKindIcon(kind: StockNotificationKind): JSX.Element {
  if (kind === 'stockout') return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  if (kind === 'low') return <TrendingDown className="h-3.5 w-3.5 text-warning" />;
  if (kind === 'new') return <Sparkles className="h-3.5 w-3.5 text-primary" />;
  return <RefreshCw className="h-3.5 w-3.5 text-success" />;
}

const KIND_STOCK_CLASS: Record<StockNotificationKind, string> = {
  stockout: 'text-destructive',
  low: 'text-warning',
  new: 'text-primary',
  restocked: 'text-success',
};

// ─── Main component ──────────────────────────────────────────────

export function StockAlertsIndicator() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('stockout');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<DatePeriod>('all');

  // `since` é recalculado apenas quando `period` muda
  const since = useMemo(() => getSince(period), [period]);

  // ── Data ──────────────────────────────────────────────────────
  const countsQuery = useStockNotificationCounts(since);
  const stockoutQuery = useStockoutAlerts(50, since);
  const lowQuery = useLowStockAlerts(50, since);
  const noveltyQuery = useNoveltyAlerts(30, since);
  const restocksQuery = useRecentRestocks(30, since);

  const counts = useMemo(
    () =>
      countsQuery.data ?? {
        stockout: 0,
        low_stock: 0,
        novelties: 0,
        restocks: 0,
        total: 0,
      },
    [countsQuery.data],
  );
  const isLoadingCounts = countsQuery.isLoading;

  // ── Tab counts map ────────────────────────────────────────────
  const tabCounts = useMemo<Record<TabKey, number>>(
    () => ({
      stockout: counts.stockout,
      low: counts.low_stock,
      new: counts.novelties,
      restocked: counts.restocks,
    }),
    [counts],
  );

  // ── Active list (client-side dismiss filter) ──────────────────
  const activeList = useMemo<StockNotificationItem[]>(() => {
    const rawMap: Record<TabKey, StockNotificationItem[]> = {
      stockout: stockoutQuery.data ?? [],
      low: lowQuery.data ?? [],
      new: noveltyQuery.data ?? [],
      restocked: restocksQuery.data ?? [],
    };
    return rawMap[activeTab].filter((item) => !dismissedIds.has(item.id));
  }, [
    activeTab,
    stockoutQuery.data,
    lowQuery.data,
    noveltyQuery.data,
    restocksQuery.data,
    dismissedIds,
  ]);

  const activeServerCount = tabCounts[activeTab];
  const activeRoute = TABS.find((t) => t.key === activeTab)?.route ?? '/estoque';

  // ── Badge dominant color ──────────────────────────────────────
  const badgeColor = useMemo(() => {
    if (counts.stockout > 0) return 'bg-destructive';
    if (counts.low_stock > 0 || counts.novelties > 0) return 'bg-warning';
    return 'bg-primary';
  }, [counts]);

  const dismiss = (id: string) => setDismissedIds((prev) => new Set([...prev, id]));

  // ── Render ────────────────────────────────────────────────────
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <PopoverTrigger asChild>
              <NotificationTrigger
                total={counts.total}
                badgeColor={badgeColor}
                isLoading={isLoadingCounts}
              />
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">Alertas de estoque</TooltipContent>
      </Tooltip>

      <PopoverContent
        className="relative w-[420px] overflow-hidden rounded-xl border-border/50 p-0 shadow-xl"
        align="end"
        sideOffset={8}
      >
        {/* Close */}
        <button
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="border-b border-border/40 px-4 pb-3 pt-4">
          <div className="flex items-center gap-2 pr-8">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="font-display text-sm font-semibold">Notificações</h3>
            <span className="ml-auto text-[10px] font-medium tabular-nums text-muted-foreground">
              {counts.total} {counts.total === 1 ? 'alerta' : 'alertas'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 border-b border-border/30 px-4 py-2">
          {TABS.map((tab) => {
            const count = tabCounts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all',
                  isActive
                    ? tab.activeColor
                    : 'border-transparent text-muted-foreground hover:bg-muted/40',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold',
                      isActive ? 'bg-current/20' : 'bg-muted',
                    )}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filtro de período */}
        <div className="flex items-center gap-1.5 border-b border-border/20 bg-muted/20 px-4 py-1.5">
          <Calendar className="h-3 w-3 shrink-0 text-muted-foreground/70" />
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
                period === p.key
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* List */}
        <ScrollArea className="h-[320px]">
          <div className="space-y-1.5 p-3">
            {activeList.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">
                  {activeServerCount > 0
                    ? 'Tudo visto nesta categoria'
                    : 'Nenhuma notificação nesta categoria'}
                </p>
              </div>
            ) : (
              activeList.map((item) => (
                <div
                  key={item.id}
                  className="group flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/30 p-2.5 transition-all hover:border-border/50 hover:bg-muted/30"
                  onClick={() => {
                    setIsOpen(false);
                    navigate(`/produto/${item.productId}`);
                  }}
                >
                  {/* Thumbnail */}
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-10 w-10 flex-shrink-0 rounded-lg border border-border/30 bg-background object-contain p-0.5"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted/40">
                      <Package className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    {/* Row 1: nome + badge + data do evento */}
                    <div className="mb-1 flex items-start gap-2">
                      <p className="line-clamp-2 flex-1 text-xs font-medium leading-tight text-foreground/90">
                        {item.productName}
                      </p>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        {getKindBadge(item.kind)}
                        {item.eventDate && (
                          <span className="text-[9px] tabular-nums text-muted-foreground/80">
                            {formatEventDate(item.eventDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Row 2: sku + estoque + fornecedor */}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="font-mono">{item.sku}</span>
                      {item.stockQuantity !== null && (
                        <span className="flex items-center gap-1">
                          {getKindIcon(item.kind)}
                          <span className={cn('font-medium', KIND_STOCK_CLASS[item.kind])}>
                            {item.stockQuantity} un.
                          </span>
                          {item.kind === 'low' && item.lowStockThreshold !== null && (
                            <span className="text-muted-foreground">
                              / {item.lowStockThreshold}
                            </span>
                          )}
                        </span>
                      )}
                      {item.supplier && <span className="truncate">{item.supplier}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-shrink-0 flex-col gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            navigate(`/produto/${item.productId}`);
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Ver produto</TooltipContent>
                    </Tooltip>
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(item.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer: "Ver todos os N" — só quando lista visível < total servidor */}
        {activeList.length > 0 && activeServerCount > activeList.length && (
          <div className="border-t border-border/30 p-2">
            <button
              className="w-full rounded-lg py-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              onClick={() => {
                setIsOpen(false);
                navigate(activeRoute);
              }}
            >
              Ver todos os {activeServerCount}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

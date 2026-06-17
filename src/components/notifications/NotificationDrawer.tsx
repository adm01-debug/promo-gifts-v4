import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Search,
  Settings2,
  ArrowLeft,
  Download,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useNotifications, type WorkspaceNotification } from '@/hooks/ui';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, formatDistanceToNow } from 'date-fns';
import { useAriaLive } from '@/components/a11y/AriaLive';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { notificationsMetrics, type TriggerSource } from '@/lib/notifications-metrics';
import { NotificationsBadgeStatsPanel } from './NotificationsBadgeStatsPanel';
import { NotificationPreferences } from './NotificationPreferences';
import { toast } from 'sonner';

const typeConfig = {
  info: { icon: Info, color: 'text-primary', bg: 'bg-primary/10' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  success: { icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10' },
  error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
};

/**
 * Default trailing-edge debounce delay (ms) for hover/focus prefetch on the bell.
 * Tuned for "feels instant on next click" while still coalescing mouse jitter
 * (~50ms) and focus-ring bouncing during keyboard navigation. Override per
 * mount via `<NotificationBell prefetchDebounceMs={...} />`.
 */
export const DEFAULT_PREFETCH_DEBOUNCE_MS = 200;

export interface NotificationBellProps {
  /**
   * Trailing-edge debounce delay in ms for hover/focus/touch prefetch triggers.
   * Defaults to {@link DEFAULT_PREFETCH_DEBOUNCE_MS}. Set to `0` to fire
   * immediately on the first event (still coalesced inside the same tick).
   */
  prefetchDebounceMs?: number;
}

/**
 * BellBadge — apenas o ícone + contador de não lidas.
 * Memoizado por `unreadCount`, `shouldShake` e `isMutationRehydrating`.
 * Durante a re-hidratação pós-mutação, esconde o número e exibe um spinner
 * sutil sobre o bell para sinalizar "valor sendo confirmado pelo servidor".
 */
const BellBadge = React.memo(function BellBadge({
  unreadCount,
  shouldShake,
  isMutationRehydrating,
}: {
  unreadCount: number;
  shouldShake: boolean;
  isMutationRehydrating: boolean;
}) {
  return (
    <>
      <div className={shouldShake ? 'animate-shake' : undefined}>
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </div>
      {isMutationRehydrating ? (
        <div
          className="absolute -right-0.5 -top-0.5 animate-scale-in"
          aria-label="Sincronizando notificações"
          role="status"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
          </span>
        </div>
      ) : unreadCount > 0 ? (
        <div className="absolute -right-0.5 -top-0.5 animate-scale-in">
          <span className="relative flex h-4 min-w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-40" />
            <Badge className="relative flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          </span>
        </div>
      ) : null}
    </>
  );
});

/**
 * RefetchSpinner — isolado para que sua animação não invalide o BellBadge
 * nem o título do drawer. Re-renderiza apenas quando `isRefetching` muda.
 */
const RefetchSpinner = React.memo(function RefetchSpinner({
  isRefetching,
}: {
  isRefetching: boolean;
}) {
  if (!isRefetching) return null;
  return (
    <span
      className="inline-flex animate-fade-in items-center text-muted-foreground"
      aria-label="Atualizando notificações"
      role="status"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
    </span>
  );
});

function NotificationItem({
  notification,
  onRead,
  onNavigate,
}: {
  notification: WorkspaceNotification;
  onRead: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const config = typeConfig[notification.type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'animate-fade-in',
        'group flex cursor-pointer gap-3 rounded-lg p-3 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm',
        !notification.is_read && 'border-l-2 border-primary bg-primary/5',
      )}
      onClick={() => {
        if (!notification.is_read) onRead(notification.id);
        if (notification.action_url) onNavigate(notification.action_url);
      }}
    >
      <div className={cn('mt-0.5 shrink-0 rounded-lg p-1.5', config.bg)}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm font-medium leading-tight',
              !notification.is_read && 'text-foreground',
              notification.is_read && 'text-muted-foreground',
            )}
          >
            {notification.title}
          </p>
          {notification.action_url && (
            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
          <Badge variant="outline" className="h-4 px-1.5 py-0 text-[9px]">
            {notification.category}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export const NotificationBell = React.forwardRef<HTMLDivElement, NotificationBellProps>(
  function NotificationBell({ prefetchDebounceMs = DEFAULT_PREFETCH_DEBOUNCE_MS }, ref) {
    const {
      notifications,
      unreadCount,
      totalCount,
      isLoading,
      isRefetching,
      isMutationRehydrating,
      page,
      search,
      category,
      unreadOnly,
      dateRange,
      setPage,
      setSearch,
      setCategory,
      setUnreadOnly,
      setDateRange,
      markAsRead: baseMarkAsRead,
      undoMarkAsRead,
      markAllAsRead,
      clearAll,
      prefetch,
    } = useNotifications();
    const navigate = useNavigate();
    const [shouldShake, setShouldShake] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [localSearch, setLocalSearch] = useState(search);
    const [localCategory, setLocalCategory] = useState(category);
    const [localUnreadOnly, setLocalUnreadOnly] = useState(unreadOnly);
    const [localDateRange, setLocalDateRange] = useState(dateRange);
    const prevCountRef = React.useRef(unreadCount);
    const { announce } = useAriaLive();
    const prevRefetchingRef = useRef(false);

    // Trigger shake animation when unread count increases
    useEffect(() => {
      if (unreadCount > prevCountRef.current) {
        setShouldShake(true);
        const timer = setTimeout(() => setShouldShake(false), 1000);
        return () => clearTimeout(timer);
      }
      prevCountRef.current = unreadCount;
    }, [unreadCount]);

    // Announce background refresh transitions for screen readers (independent from spinner)
    useEffect(() => {
      if (isRefetching && !prevRefetchingRef.current) {
        announce('Atualizando notificações', 'polite');
      } else if (!isRefetching && prevRefetchingRef.current) {
        announce(
          unreadCount > 0
            ? `Notificações atualizadas. ${unreadCount} não lida${unreadCount > 1 ? 's' : ''}.`
            : 'Notificações atualizadas.',
          'polite',
        );
      }
      prevRefetchingRef.current = isRefetching;
    }, [isRefetching, unreadCount, announce]);

    // Debounced search and filters update
    useEffect(() => {
      const timeout = setTimeout(() => {
        setSearch(localSearch);
        setCategory(localCategory);
        setUnreadOnly(localUnreadOnly);
        setDateRange(localDateRange);
      }, 400);
      return () => clearTimeout(timeout);
    }, [
      localSearch,
      localCategory,
      localUnreadOnly,
      localDateRange,
      setSearch,
      setCategory,
      setUnreadOnly,
      setDateRange,
    ]);

    const markAsRead = useCallback(
      async (id: string) => {
        await baseMarkAsRead(id);
        toast.success('Notificação marcada como lida', {
          action: {
            label: 'Desfazer',
            onClick: () => undoMarkAsRead(id),
          },
        });
      },
      [baseMarkAsRead, undoMarkAsRead],
    );

    const handleClearFilters = () => {
      setLocalSearch('');
      setLocalCategory('all');
      setLocalUnreadOnly(false);
      setLocalDateRange({ from: undefined, to: undefined });
    };

    const hasActiveFilters =
      localSearch !== '' ||
      localCategory !== 'all' ||
      localUnreadOnly ||
      localDateRange?.from ||
      localDateRange?.to;

    const handleExportCSV = useCallback(() => {
      if (notifications.length === 0) return;

      const headers = ['Data', 'Título', 'Mensagem', 'Tipo', 'Categoria', 'Lida'];
      const rows = notifications.map((n: WorkspaceNotification) => [
        new Date(n.created_at).toLocaleString('pt-BR'),
        n.title,
        n.message,
        n.type,
        n.category,
        n.is_read ? 'Sim' : 'Não',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `notificacoes_${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Exportação concluída');
    }, [notifications]);

    const handleNavigate = (url: string) => {
      if (url.startsWith('/')) {
        navigate(url);
      } else {
        window.open(url, '_blank');
      }
    };

    // Debounce prefetch on hover/focus to coalesce rapid bursts (mouse jitter, focus rings).
    // The hook itself enforces a 5s TTL, but the trailing-edge debounce avoids even queuing
    // microtasks for repeated events within the window. Delay is configurable via
    // `prefetchDebounceMs` so consumers can tune it per surface (or set 0 for tests).
    //
    // We also instrument the FULL trigger→fetch latency: from the very FIRST hover/focus
    // event of a burst to the moment `prefetch()` resolves. This sample is fed back into
    // notificationsMetrics so QA can confirm the debounce keeps the round-trip well within
    // the 5s prefetch TTL window (TRIGGER_TO_FETCH_TTL_MS).
    const prefetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const delayRef = useRef(prefetchDebounceMs);
    const burstStartRef = useRef<number | null>(null);
    const burstSourceRef = useRef<TriggerSource | null>(null);
    const burstCountRef = useRef(0);
    useEffect(() => {
      delayRef.current = prefetchDebounceMs;
    }, [prefetchDebounceMs]);
    useEffect(
      () => () => {
        if (prefetchDebounceRef.current) clearTimeout(prefetchDebounceRef.current);
      },
      [],
    );
    const debouncedPrefetch = useCallback(
      (source: TriggerSource) => {
        notificationsMetrics.recordTrigger(source);
        // First event of a burst seeds the timing window.
        if (burstStartRef.current === null) {
          burstStartRef.current = performance.now();
          burstSourceRef.current = source;
          burstCountRef.current = 0;
        }
        burstCountRef.current += 1;
        if (prefetchDebounceRef.current) clearTimeout(prefetchDebounceRef.current);
        prefetchDebounceRef.current = setTimeout(() => {
          prefetchDebounceRef.current = null;
          const burstStart = burstStartRef.current ?? performance.now();
          const burstSource = burstSourceRef.current ?? source;
          const coalesced = burstCountRef.current;
          // Reset BEFORE awaiting so a new burst arriving during the fetch starts a fresh window.
          burstStartRef.current = null;
          burstSourceRef.current = null;
          burstCountRef.current = 0;
          const debounceMs = performance.now() - burstStart;
          const fetchStart = performance.now();
          void prefetch().finally(() => {
            notificationsMetrics.recordTriggerToFetch({
              source: burstSource,
              debounceMs,
              fetchMs: performance.now() - fetchStart,
              coalescedTriggers: coalesced,
            });
          });
        }, delayRef.current);
      },
      [prefetch],
    );

    return (
      <Sheet
        onOpenChange={(open) => {
          setIsOpen(open);
          if (open) {
            // BUG-NOTIF-11: Marcação automática como lida ao abrir
            if (unreadCount > 0) {
              markAllAsRead();
            }
            setShowPreferences(false);

            const burstStart = burstStartRef.current ?? performance.now();
            const coalesced = burstCountRef.current;
            if (prefetchDebounceRef.current) {
              clearTimeout(prefetchDebounceRef.current);
              prefetchDebounceRef.current = null;
            }
            burstStartRef.current = null;
            burstSourceRef.current = null;
            burstCountRef.current = 0;
            notificationsMetrics.recordTrigger('drawer-open');
            const debounceMs = performance.now() - burstStart;
            const fetchStart = performance.now();
            void prefetch().finally(() => {
              notificationsMetrics.recordTriggerToFetch({
                source: 'drawer-open',
                debounceMs,
                fetchMs: performance.now() - fetchStart,
                coalescedTriggers: coalesced + 1,
              });
            });
          }
        }}
      >
        <SheetTrigger asChild>
          <div ref={ref}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-full text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground"
                  aria-label={
                    unreadCount > 0
                      ? `Notificações, ${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
                      : 'Notificações'
                  }
                  aria-haspopup="dialog"
                  aria-expanded={isOpen}
                  onMouseEnter={() => debouncedPrefetch('hover')}
                  onFocus={() => debouncedPrefetch('focus')}
                  onTouchStart={() => debouncedPrefetch('hover')}
                >
                  <BellBadge
                    unreadCount={unreadCount}
                    shouldShake={shouldShake}
                    isMutationRehydrating={isMutationRehydrating}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notificações {unreadCount > 0 && `(${unreadCount})`}</TooltipContent>
            </Tooltip>
          </div>
        </SheetTrigger>

        <SheetContent className="flex w-full flex-col p-0 sm:w-[400px]">
          <SheetHeader className="border-b border-border px-4 pb-3 pt-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-lg">
                {showPreferences ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowPreferences(false)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                ) : (
                  <Bell className="h-5 w-5 text-primary" />
                )}
                {showPreferences ? 'Preferências' : 'Notificações'}
                {!showPreferences && unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </Badge>
                )}
                <RefetchSpinner isRefetching={isRefetching} />
              </SheetTitle>
              <div className="flex items-center gap-1">
                {!showPreferences && notifications.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Exportar CSV"
                        onClick={handleExportCSV}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Exportar CSV</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('h-8 w-8', showPreferences && 'bg-primary/10 text-primary')}
                      onClick={() => setShowPreferences(!showPreferences)}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Configurações</TooltipContent>
                </Tooltip>
                {!showPreferences && unreadCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={markAllAsRead}
                        aria-label="CheckCheck"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Marcar todas como lidas</TooltipContent>
                  </Tooltip>
                )}
                {notifications.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={clearAll}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Limpar todas</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            {showPreferences ? (
              <div className="p-4">
                <NotificationPreferences />
              </div>
            ) : (
              <>
                <div className="sticky top-0 z-10 space-y-3 border-b bg-background p-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar notificações..."
                      className="pl-9"
                      value={localSearch}
                      onChange={(e) => setLocalSearch(e.target.value)}
                    />
                  </div>
                  <Tabs value={localCategory} onValueChange={setLocalCategory}>
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="all">Todas</TabsTrigger>
                      <TabsTrigger value="security">Segurança</TabsTrigger>
                      <TabsTrigger value="system">Sistema</TabsTrigger>
                      <TabsTrigger value="marketing">Marketing</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="unread-only"
                        checked={localUnreadOnly}
                        onCheckedChange={setLocalUnreadOnly}
                      />
                      <Label htmlFor="unread-only" className="text-xs">
                        Não lidas
                      </Label>
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            'h-8 justify-start text-left text-xs font-normal',
                            !localDateRange?.from && 'text-muted-foreground',
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {localDateRange?.from ? (
                            localDateRange.to ? (
                              <>
                                {format(localDateRange.from, 'dd/MM/yy')} -{' '}
                                {format(localDateRange.to, 'dd/MM/yy')}
                              </>
                            ) : (
                              format(localDateRange.from, 'dd/MM/yy')
                            )
                          ) : (
                            <span>Intervalo de datas</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={localDateRange?.from}
                          selected={localDateRange}
                          onSelect={(range) =>
                            setLocalDateRange({
                              from: range?.from ?? undefined,
                              to: range?.to ?? undefined,
                            })
                          }
                          numberOfMonths={1}
                        />
                      </PopoverContent>
                    </Popover>

                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-muted-foreground"
                        onClick={handleClearFilters}
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>

                {isLoading && notifications.length === 0 ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 4 }, (_, i) => (
                      <div key={i} className="flex animate-pulse gap-3">
                        <div className="h-9 w-9 rounded-lg bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4 rounded bg-muted" />
                          <div className="h-3 w-1/2 rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                    <div className="mb-4 rounded-full bg-muted/50 p-4">
                      <Bell className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhuma notificação</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Você será notificado sobre atividades importantes
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {notifications.map((n) => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onRead={markAsRead}
                        onNavigate={handleNavigate}
                      />
                    ))}
                    {totalCount > 20 && (
                      <div className="border-t border-border p-4">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (page > 1) setPage(page - 1);
                                }}
                                className={cn(page === 1 && 'pointer-events-none opacity-50')}
                              />
                            </PaginationItem>
                            <PaginationItem>
                              <span className="px-2 text-xs text-muted-foreground">
                                Página {page} de {Math.ceil(totalCount / 20)}
                              </span>
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (page < Math.ceil(totalCount / 20)) setPage(page + 1);
                                }}
                                className={cn(
                                  page === Math.ceil(totalCount / 20) &&
                                    'pointer-events-none opacity-50',
                                )}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </ScrollArea>
          <NotificationsBadgeStatsPanel />
        </SheetContent>
      </Sheet>
    );
  },
);

NotificationBell.displayName = 'NotificationBell';

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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useNotifications, type WorkspaceNotification } from '@/hooks/ui';
import { useAriaLive } from '@/components/a11y/AriaLive';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { notificationsMetrics, type TriggerSource } from '@/lib/notifications-metrics';
import { NotificationsBadgeStatsPanel } from './NotificationsBadgeStatsPanel';

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
      <motion.div
        animate={
          shouldShake
            ? {
                rotate: [0, -15, 15, -10, 10, -5, 5, 0],
                transition: { duration: 0.6 },
              }
            : {}
        }
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </motion.div>
      <AnimatePresence mode="wait">
        {isMutationRehydrating ? (
          <motion.div
            key="rehydrating"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute -right-0.5 -top-0.5"
            aria-label="Sincronizando notificações"
            role="status"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
            </span>
          </motion.div>
        ) : unreadCount > 0 ? (
          <motion.div
            key="badge"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className="absolute -right-0.5 -top-0.5"
          >
            <span className="relative flex h-4 min-w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-40" />
              <Badge className="relative flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
  return (
    <AnimatePresence>
      {isRefetching && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center text-muted-foreground"
          aria-label="Atualizando notificações"
          role="status"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        </motion.span>
      )}
    </AnimatePresence>
  );
});

/**
 * DrawerHeaderTitle — título + contador "X novas". Depende apenas de
 * `unreadCount`; o spinner de refetch é renderizado como filho independente.
 */
const DrawerHeaderTitle = React.memo(function DrawerHeaderTitle({
  unreadCount,
}: {
  unreadCount: number;
}) {
  return (
    <>
      <Bell className="h-5 w-5 text-primary" />
      Notificações
      {unreadCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {unreadCount} nova{unreadCount > 1 ? 's' : ''}
        </Badge>
      )}
    </>
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
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
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
    </motion.div>
  );
}

export const NotificationBell = React.forwardRef<HTMLDivElement, NotificationBellProps>(
  function NotificationBell({ prefetchDebounceMs = DEFAULT_PREFETCH_DEBOUNCE_MS }, ref) {
    const {
      notifications,
      unreadCount,
      isLoading,
      isRefetching,
      isMutationRehydrating,
      markAsRead,
      markAllAsRead,
      clearAll,
      prefetch,
    } = useNotifications();
    const navigate = useNavigate();
    const [shouldShake, setShouldShake] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
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
            // If a debounce was already pending, fold its burst into the drawer-open
            // sample (so the timing represents the user's intent end-to-end).
            const burstStart = burstStartRef.current ?? performance.now();
            const coalesced = burstCountRef.current; // may be 0 for direct clicks
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
              <TooltipContent className="border-border bg-card text-xs">
                Notificações {unreadCount > 0 && `(${unreadCount})`}
              </TooltipContent>
            </Tooltip>
          </div>
        </SheetTrigger>

        <SheetContent className="flex w-full flex-col p-0 sm:w-[400px]">
          <SheetHeader className="border-b border-border px-4 pb-3 pt-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-lg">
                <DrawerHeaderTitle unreadCount={unreadCount} />
                <RefetchSpinner isRefetching={isRefetching} />
              </SheetTitle>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
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
            {isLoading && notifications.length === 0 ? (
              <div className="space-y-3 p-4">
                {[...Array(4)].map((_, i) => (
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
              </div>
            )}
          </ScrollArea>
          <NotificationsBadgeStatsPanel />
        </SheetContent>
      </Sheet>
    );
  },
);

NotificationBell.displayName = 'NotificationBell';

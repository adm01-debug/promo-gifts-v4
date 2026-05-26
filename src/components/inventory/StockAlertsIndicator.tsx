import { useState, forwardRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  TrendingDown,
  Package,
  X,
  ExternalLink,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils';
import {
  useNoveltiesWithDetails,
  useReplenishmentsWithDetails,
  useStockAlerts,
} from '@/hooks/products';

// ─── Types ───────────────────────────────────────────────────

type NotificationType = 'stock' | 'new' | 'restocked';

interface NotificationItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl: string | null;
  type: NotificationType;
  /** stock-specific */
  currentStock?: number;
  alertLevel?: 'low' | 'critical' | 'out';
  supplier?: string;
}

interface StockAlertsIndicatorProps {
  lowStockThreshold?: number;
  criticalStockThreshold?: number;
}

// ─── Tab config ──────────────────────────────────────────────

const TABS: { key: NotificationType; label: string; color: string; activeColor: string }[] = [
  {
    key: 'stock',
    label: 'Zerou',
    color: 'text-destructive',
    activeColor: 'bg-destructive/10 text-destructive border-destructive',
  },
  {
    key: 'new',
    label: 'Novidade',
    color: 'text-primary',
    activeColor: 'bg-primary/10 text-primary border-primary',
  },
  {
    key: 'restocked',
    label: 'Chegou',
    color: 'text-primary',
    activeColor: 'bg-primary/10 text-primary border-primary',
  },
];

// ─── Trigger ─────────────────────────────────────────────────

interface TriggerProps extends React.ComponentPropsWithoutRef<typeof Button> {
  totalCount: number;
  dominantColor: string;
}

const NotificationTrigger = forwardRef<HTMLButtonElement, TriggerProps>(
  ({ totalCount, dominantColor, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className="relative h-8 w-8 rounded-full text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground"
      {...props}
      aria-label="Alertas de estoque"
    >
      <Package className="h-[17px] w-[17px]" strokeWidth={1.75} />
      {totalCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cn(
            'absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-primary-foreground',
            dominantColor,
          )}
        >
          {totalCount > 99 ? '99+' : totalCount}
        </motion.span>
      )}
    </Button>
  ),
);
NotificationTrigger.displayName = 'NotificationTrigger';

// ─── Main component ─────────────────────────────────────────

export function StockAlertsIndicator({
  lowStockThreshold = 50,
  criticalStockThreshold = 10,
}: StockAlertsIndicatorProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<NotificationType>('stock');

  // ── Queries ──
  const { data: stockAlerts = [], isLoading: loadingStock } = useStockAlerts(
    lowStockThreshold,
    criticalStockThreshold,
  );
  const { data: novelties = [], isLoading: loadingNovelties } = useNoveltiesWithDetails({
    limit: 30,
  });
  const { data: replenishments = [], isLoading: loadingReplenishments } =
    useReplenishmentsWithDetails({ limit: 30 });

  const isLoading = loadingStock || loadingNovelties || loadingReplenishments;

  // ── Normalization ──
  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];

    // Stock alerts
    stockAlerts.forEach((a) => {
      items.push({
        id: a.id,
        productId: a.productId,
        productName: a.productName,
        sku: a.sku,
        imageUrl: a.imageUrl,
        type: 'stock',
        currentStock: a.currentStock,
        alertLevel: a.alertLevel,
        supplier: a.supplier,
      });
    });

    // Novelties
    novelties.forEach((n) => {
      items.push({
        id: `new-${n.product_id}`,
        productId: n.product_id,
        productName: n.product_name,
        sku: n.product_sku || '',
        imageUrl: n.product_image,
        type: 'new',
        supplier: n.supplier_name || '',
      });
    });

    // Replenishments
    replenishments.forEach((r) => {
      items.push({
        id: `restocked-${r.product_id}`,
        productId: r.product_id,
        productName: r.product_name,
        sku: r.product_sku || '',
        imageUrl: r.product_image,
        type: 'restocked',
        currentStock: r.stock_quantity,
        supplier: r.supplier_name || '',
      });
    });

    return items;
  }, [stockAlerts, novelties, replenishments]);

  // ── Derived state ──
  const visible = useMemo(
    () => notifications.filter((n) => !dismissedIds.has(n.id)),
    [notifications, dismissedIds],
  );

  const counts = useMemo(() => {
    const stock = visible.filter((n) => n.type === 'stock').length;
    const newP = visible.filter((n) => n.type === 'new').length;
    const restocked = visible.filter((n) => n.type === 'restocked').length;
    return { stock, new: newP, restocked, total: stock + newP + restocked };
  }, [visible]);

  const filteredByTab = useMemo(
    () => visible.filter((n) => n.type === activeTab),
    [visible, activeTab],
  );

  // Dominant color for badge: priority → red (critical stock) > orange (stock) > blue (new) > green (restocked)
  const hasCritical = visible.some(
    (n) => n.type === 'stock' && (n.alertLevel === 'critical' || n.alertLevel === 'out'),
  );
  const dominantColor = hasCritical
    ? 'bg-destructive'
    : counts.stock > 0
      ? 'bg-brand-primary'
      : counts.new > 0
        ? 'bg-primary'
        : 'bg-primary';

  const dismiss = (id: string) => setDismissedIds((prev) => new Set([...prev, id]));

  // ── Render helpers ──
  const getStockBadge = (level?: 'low' | 'critical' | 'out') => {
    switch (level) {
      case 'out':
        return (
          <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
            Esgotado
          </Badge>
        );
      case 'critical':
        return (
          <Badge className="bg-brand-primary px-1.5 py-0 text-[10px] text-primary-foreground">
            Crítico
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            Baixo
          </Badge>
        );
    }
  };

  const getStockIcon = (level?: 'low' | 'critical' | 'out') => {
    switch (level) {
      case 'out':
        return <Package className="h-3.5 w-3.5 text-destructive" />;
      case 'critical':
        return <AlertTriangle className="h-3.5 w-3.5 text-brand-primary" />;
      default:
        return <TrendingDown className="h-3.5 w-3.5 text-warning" />;
    }
  };

  const getTypeBadge = (n: NotificationItem) => {
    if (n.type === 'stock') return getStockBadge(n.alertLevel);
    if (n.type === 'new')
      return (
        <Badge className="bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">Novo</Badge>
      );
    return (
      <Badge className="bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">Reposto</Badge>
    );
  };

  const getTypeIcon = (n: NotificationItem) => {
    if (n.type === 'stock') return getStockIcon(n.alertLevel);
    if (n.type === 'new') return <Sparkles className="h-3.5 w-3.5 text-primary" />;
    return <RefreshCw className="h-3.5 w-3.5 text-primary" />;
  };

  if (isLoading || counts.total === 0) return null;

  return (
    <div>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <PopoverTrigger asChild>
                <NotificationTrigger
                  totalCount={counts.total}
                  dominantColor={dominantColor}
                  aria-label="Alertas de estoque"
                />
              </PopoverTrigger>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Alerta de Estoque
          </TooltipContent>
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
              const count = counts[tab.key];
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

          {/* List */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-1.5 p-3">
              <AnimatePresence>
                {filteredByTab.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.02 }}
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
                      />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted/40">
                        <Package className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start gap-2">
                        <p className="line-clamp-2 flex-1 text-xs font-medium leading-tight text-foreground/90">
                          {item.productName}
                        </p>
                        {getTypeBadge(item)}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="font-mono">{item.sku}</span>
                        {item.type === 'stock' && (
                          <span className="flex items-center gap-1">
                            {getTypeIcon(item)}
                            <span
                              className={cn(
                                'font-medium',
                                item.alertLevel === 'out' && 'text-destructive',
                              )}
                            >
                              {item.currentStock} un.
                            </span>
                          </span>
                        )}
                        {item.type === 'restocked' && item.currentStock !== undefined && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="h-3 w-3 text-primary" />
                            <span className="font-medium text-primary">
                              {item.currentStock} un.
                            </span>
                          </span>
                        )}
                        {item.type === 'new' && (
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-primary" />
                            <span className="font-medium text-primary">Recém-cadastrado</span>
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
                        <TooltipContent side="left" className="text-[11px]">
                          Ver produto
                        </TooltipContent>
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
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredByTab.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">Nenhuma notificação nesta categoria</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

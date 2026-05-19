import { useState, forwardRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, TrendingDown, Package, X,
  ExternalLink, Sparkles, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { cn } from "@/lib/utils";
import { useNoveltiesWithDetails, useReplenishmentsWithDetails, useStockAlerts } from "@/hooks/products";

// ─── Types ───────────────────────────────────────────────────

type NotificationType = "stock" | "new" | "restocked";

interface NotificationItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl: string | null;
  type: NotificationType;
  /** stock-specific */
  currentStock?: number;
  alertLevel?: "low" | "critical" | "out";
  supplier?: string;
}

interface StockAlertsIndicatorProps {
  lowStockThreshold?: number;
  criticalStockThreshold?: number;
}

// ─── Tab config ──────────────────────────────────────────────

const TABS: { key: NotificationType; label: string; color: string; activeColor: string }[] = [
  { key: "stock", label: "Zerou", color: "text-destructive", activeColor: "bg-destructive/10 text-destructive border-destructive" },
  { key: "new", label: "Novidade", color: "text-primary", activeColor: "bg-primary/10 text-primary border-primary" },
  { key: "restocked", label: "Chegou", color: "text-primary", activeColor: "bg-primary/10 text-primary border-primary" },
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
      className="relative h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all duration-200"
      {...props}
      aria-label="Alertas de estoque"
    >
      <Package className="h-[17px] w-[17px]" strokeWidth={1.75} />
      {totalCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cn(
            "absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 flex items-center justify-center text-[9px] font-bold rounded-full text-primary-foreground",
            dominantColor
          )}
        >
          {totalCount > 99 ? "99+" : totalCount}
        </motion.span>
      )}
    </Button>
  )
);
NotificationTrigger.displayName = "NotificationTrigger";

// ─── Main component ─────────────────────────────────────────

export function StockAlertsIndicator({
  lowStockThreshold = 50,
  criticalStockThreshold = 10,
}: StockAlertsIndicatorProps) {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<NotificationType>("stock");

    // ── Queries ──
    const { data: stockAlerts = [], isLoading: loadingStock } = useStockAlerts(lowStockThreshold, criticalStockThreshold);
    const { data: novelties = [], isLoading: loadingNovelties } = useNoveltiesWithDetails({ limit: 30 });
    const { data: replenishments = [], isLoading: loadingReplenishments } = useReplenishmentsWithDetails({ limit: 30 });

    const isLoading = loadingStock || loadingNovelties || loadingReplenishments;

    // ── Normalization ──
    const notifications = useMemo(() => {
      const items: NotificationItem[] = [];

      // Stock alerts
      stockAlerts.forEach(a => {
        items.push({
          id: a.id,
          productId: a.productId,
          productName: a.productName,
          sku: a.sku,
          imageUrl: a.imageUrl,
          type: "stock",
          currentStock: a.currentStock,
          alertLevel: a.alertLevel,
          supplier: a.supplier,
        });
      });

      // Novelties
      novelties.forEach(n => {
        items.push({
          id: `new-${n.product_id}`,
          productId: n.product_id,
          productName: n.product_name,
          sku: n.product_sku || "",
          imageUrl: n.product_image,
          type: "new",
          supplier: n.supplier_name || "",
        });
      });

      // Replenishments
      replenishments.forEach(r => {
        items.push({
          id: `restocked-${r.product_id}`,
          productId: r.product_id,
          productName: r.product_name,
          sku: r.product_sku || "",
          imageUrl: r.product_image,
          type: "restocked",
          currentStock: r.stock_quantity,
          supplier: r.supplier_name || "",
        });
      });

      return items;
    }, [stockAlerts, novelties, replenishments]);

    // ── Derived state ──
    const visible = useMemo(
      () => notifications.filter(n => !dismissedIds.has(n.id)),
      [notifications, dismissedIds]
    );

    const counts = useMemo(() => {
      const stock = visible.filter(n => n.type === "stock").length;
      const newP = visible.filter(n => n.type === "new").length;
      const restocked = visible.filter(n => n.type === "restocked").length;
      return { stock, new: newP, restocked, total: stock + newP + restocked };
    }, [visible]);

    const filteredByTab = useMemo(
      () => visible.filter(n => n.type === activeTab),
      [visible, activeTab]
    );

    // Dominant color for badge: priority → red (critical stock) > orange (stock) > blue (new) > green (restocked)
    const hasCritical = visible.some(n => n.type === "stock" && (n.alertLevel === "critical" || n.alertLevel === "out"));
    const dominantColor = hasCritical
      ? "bg-destructive"
      : counts.stock > 0
        ? "bg-orange"
        : counts.new > 0
          ? "bg-primary"
          : "bg-primary";

    const dismiss = (id: string) => setDismissedIds(prev => new Set([...prev, id]));

    // ── Render helpers ──
    const getStockBadge = (level?: "low" | "critical" | "out") => {
      switch (level) {
        case "out":
          return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Esgotado</Badge>;
        case "critical":
          return <Badge className="bg-orange text-primary-foreground text-[10px] px-1.5 py-0">Crítico</Badge>;
        default:
          return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Baixo</Badge>;
      }
    };

    const getStockIcon = (level?: "low" | "critical" | "out") => {
      switch (level) {
        case "out":
          return <Package className="h-3.5 w-3.5 text-destructive" />;
        case "critical":
          return <AlertTriangle className="h-3.5 w-3.5 text-orange" />;
        default:
          return <TrendingDown className="h-3.5 w-3.5 text-warning" />;
      }
    };

    const getTypeBadge = (n: NotificationItem) => {
      if (n.type === "stock") return getStockBadge(n.alertLevel);
      if (n.type === "new") return <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">Novo</Badge>;
      return <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">Reposto</Badge>;
    };

    const getTypeIcon = (n: NotificationItem) => {
      if (n.type === "stock") return getStockIcon(n.alertLevel);
      if (n.type === "new") return <Sparkles className="h-3.5 w-3.5 text-primary" />;
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
                  <NotificationTrigger totalCount={counts.total} dominantColor={dominantColor} aria-label="Alertas de estoque" />
                </PopoverTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Alerta de Estoque
            </TooltipContent>
          </Tooltip>

          <PopoverContent
            className="w-[420px] p-0 rounded-xl border-border/50 shadow-xl overflow-hidden relative"
            align="end"
            sideOffset={8}
          >
            {/* Close */}
            <button aria-label="Fechar"
              className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors z-10"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-border/40">
              <div className="flex items-center gap-2 pr-8">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-3.5 w-3.5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-sm">Notificações</h3>
                <span className="text-[10px] text-muted-foreground font-medium tabular-nums ml-auto">
                  {counts.total} {counts.total === 1 ? "alerta" : "alertas"}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 px-4 py-2 border-b border-border/30">
              {TABS.map(tab => {
                const count = counts[tab.key];
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                      isActive
                        ? tab.activeColor
                        : "border-transparent text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className={cn(
                        "h-4 min-w-4 px-1 flex items-center justify-center text-[9px] font-bold rounded-full",
                        isActive ? "bg-current/20" : "bg-muted"
                      )}>
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* List */}
            <ScrollArea className="h-[400px]">
              <div className="p-3 space-y-1.5">
                <AnimatePresence>
                  {filteredByTab.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border/30 hover:border-border/50 hover:bg-muted/30 transition-all group cursor-pointer"
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
                          className="w-10 h-10 rounded-lg object-contain bg-background border border-border/30 flex-shrink-0 p-0.5" loading="lazy" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted/40 flex-shrink-0 flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-1">
                          <p className="text-xs font-medium text-foreground/90 leading-tight line-clamp-2 flex-1">
                            {item.productName}
                          </p>
                          {getTypeBadge(item)}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="font-mono">{item.sku}</span>
                          {item.type === "stock" && (
                            <span className="flex items-center gap-1">
                              {getTypeIcon(item)}
                              <span className={cn(
                                "font-medium",
                                item.alertLevel === "out" && "text-destructive"
                              )}>
                                {item.currentStock} un.
                              </span>
                            </span>
                          )}
                          {item.type === "restocked" && item.currentStock !== undefined && (
                            <span className="flex items-center gap-1">
                              <RefreshCw className="h-3 w-3 text-primary" />
                              <span className="font-medium text-primary">{item.currentStock} un.</span>
                            </span>
                          )}
                          {item.type === "new" && (
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-primary" />
                              <span className="font-medium text-primary">Recém-cadastrado</span>
                            </span>
                          )}
                          {item.supplier && (
                            <span className="truncate">{item.supplier}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                                navigate(`/produto/${item.productId}`);
                              }}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-[11px]">Ver produto</TooltipContent>
                        </Tooltip>
                        <button
                          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
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
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
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

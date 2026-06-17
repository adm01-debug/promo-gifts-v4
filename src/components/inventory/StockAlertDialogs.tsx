import { useMemo } from 'react';
import { AlertTriangle, TrendingDown, X, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCard } from './StockAlertCard';
import type { StockAlert } from '@/types/stock';

interface StockAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: StockAlert[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

// Summary bar for alert dialogs
function AlertSummaryBar({
  alerts,
  variant,
}: {
  alerts: StockAlert[];
  variant: 'critical' | 'warning';
}) {
  const stats = useMemo(() => {
    const products = new Set(alerts.map((a) => a.productId)).size;
    const totalAffected = alerts.reduce((s, a) => s + (a.threshold - a.currentStock), 0);
    const outOfStock = alerts.filter((a) => a.type === 'out_of_stock').length;
    const lowStock = alerts.filter((a) => a.type === 'low_stock' || a.type === 'critical').length;
    return { products, totalAffected, outOfStock, lowStock };
  }, [alerts]);

  if (alerts.length === 0) return null;

  const isCritical = variant === 'critical';

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div
        className={`rounded-lg border p-2.5 text-center ${isCritical ? 'border-destructive/15 bg-destructive/5' : 'border-warning/15 bg-warning/5'}`}
      >
        <p className="text-xs text-muted-foreground">Alertas</p>
        <p
          className={`text-xl font-bold tabular-nums ${isCritical ? 'text-destructive' : 'text-warning'}`}
        >
          {alerts.length}
        </p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
        <p className="text-xs text-muted-foreground">Produtos</p>
        <p className="text-xl font-bold tabular-nums">{stats.products}</p>
      </div>
      {stats.outOfStock > 0 && (
        <div className="rounded-lg border border-destructive/15 bg-destructive/5 p-2.5 text-center">
          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <XCircle className="h-3 w-3" />
            Esgotados
          </p>
          <p className="text-xl font-bold tabular-nums text-destructive">{stats.outOfStock}</p>
        </div>
      )}
      {stats.lowStock > 0 && (
        <div className="rounded-lg border border-warning/15 bg-warning/5 p-2.5 text-center">
          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <TrendingDown className="h-3 w-3" />
            Baixo
          </p>
          <p className="text-xl font-bold tabular-nums text-warning">{stats.lowStock}</p>
        </div>
      )}
    </div>
  );
}

// Empty state
function AlertEmptyState({ variant }: { variant: 'critical' | 'warning' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-8 w-8 text-success" />
      </div>
      <p className="mb-1 font-semibold text-foreground">
        {variant === 'critical' ? 'Nenhum alerta crítico' : 'Nenhum alerta de estoque baixo'}
      </p>
      <p className="max-w-xs text-center text-sm">
        {variant === 'critical'
          ? 'Todos os produtos estão com estoque disponível. Continue monitorando!'
          : 'Todos os produtos estão com níveis adequados de estoque.'}
      </p>
    </div>
  );
}

export function OutOfStockDialog({
  open,
  onOpenChange,
  alerts,
  onDismiss,
  onDismissAll,
}: StockAlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
            </div>
            Alertas Críticos
            <Badge variant="destructive" className="ml-1 font-normal">
              {alerts.length}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Produtos sem estoque ou em nível crítico que precisam de atenção imediata.
          </DialogDescription>
        </DialogHeader>

        <AlertSummaryBar alerts={alerts} variant="critical" />

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={onDismissAll}
            disabled={alerts.length === 0}
            aria-label="Dispensar todos os alertas críticos"
          >
            <X className="h-3.5 w-3.5" />
            Limpar Todos
          </Button>
        </div>
        <ScrollArea className="max-h-[50vh] flex-1">
          {alerts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onDismiss={() => onDismiss(alert.id)} />
              ))}
            </div>
          ) : (
            <AlertEmptyState variant="critical" />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function LowStockDialog({
  open,
  onOpenChange,
  alerts,
  onDismiss,
  onDismissAll,
}: StockAlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10">
              <TrendingDown className="h-4 w-4" />
            </div>
            Alertas de Estoque Baixo
            <Badge
              variant="outline"
              className="ml-1 border-warning/20 bg-warning/10 font-normal text-warning"
            >
              {alerts.length}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Produtos com nível de estoque baixo ou com previsão de esgotamento.
          </DialogDescription>
        </DialogHeader>

        <AlertSummaryBar alerts={alerts} variant="warning" />

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={onDismissAll}
            disabled={alerts.length === 0}
            aria-label="Dispensar todos os alertas de estoque baixo"
          >
            <X className="h-3.5 w-3.5" />
            Limpar Todos
          </Button>
        </div>
        <ScrollArea className="max-h-[50vh] flex-1">
          {alerts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onDismiss={() => onDismiss(alert.id)} />
              ))}
            </div>
          ) : (
            <AlertEmptyState variant="warning" />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

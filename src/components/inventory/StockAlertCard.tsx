import { AlertCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StockAlert } from '@/types/stock';

const severityStyles = {
  info: 'border-primary/30 bg-primary/5 hover:bg-primary/8',
  warning: 'border-warning/30 bg-warning/5 hover:bg-warning/8',
  error: 'border-destructive/30 bg-destructive/5 hover:bg-destructive/8',
};

const severityIcons = {
  info: <AlertCircle className="h-4 w-4 shrink-0 text-primary" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />,
  error: <XCircle className="h-4 w-4 shrink-0 text-destructive" />,
};

export function AlertCard({ alert, onDismiss }: { alert: StockAlert; onDismiss: () => void }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-all duration-200',
        severityStyles[alert.severity],
      )}
      role="alert"
    >
      <div className="mt-0.5">{severityIcons[alert.severity]}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{alert.productName}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{alert.message}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded bg-muted/50 px-1 font-mono text-[10px] text-muted-foreground">
            {alert.productSku}
          </span>
          {alert.suggestedAction && (
            <span className="text-[10px] font-medium text-primary">→ {alert.suggestedAction}</span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
        onClick={onDismiss}
        aria-label={`Dispensar alerta de ${alert.productName}`}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

import { cn } from '@/lib/utils';
import type { Flame } from 'lucide-react';

interface RiskKpiProps {
  icon: typeof Flame;
  label: string;
  value: string;
  sub: string;
  alert?: boolean;
  warning?: boolean;
}

export function RiskKpi({ icon: Icon, label, value, sub, alert, warning }: RiskKpiProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-1.5 text-center',
        alert
          ? 'border border-destructive/20 bg-destructive/10'
          : warning
            ? 'border border-warning/20 bg-warning/10'
            : 'bg-muted/50',
      )}
      role="status"
    >
      <div className="mb-0.5 flex items-center justify-center gap-1">
        <Icon
          className={cn(
            'h-2.5 w-2.5',
            alert ? 'text-destructive' : warning ? 'text-warning' : 'text-muted-foreground',
          )}
          aria-hidden="true"
        />
        <p className="text-[9px] leading-tight text-muted-foreground">{label}</p>
      </div>
      <p
        className={cn(
          'text-xs font-bold',
          alert ? 'text-destructive' : warning ? 'text-warning' : 'text-foreground',
        )}
      >
        {value}
      </p>
      <p className="text-[9px] text-muted-foreground">{sub}</p>
    </div>
  );
}

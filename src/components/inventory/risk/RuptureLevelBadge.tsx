import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RuptureLevel } from '@/hooks/stock/useRuptureAlerts';

const STYLES: Record<RuptureLevel, string> = {
  RUPTURA: 'border-destructive/40 bg-destructive/15 text-destructive',
  'CRÍTICO': 'border-destructive/30 bg-destructive/10 text-destructive',
  ALERTA: 'border-warning/40 bg-warning/15 text-warning',
  'ATENÇÃO': 'border-warning/30 bg-warning/10 text-warning',
  OK: 'border-success/30 bg-success/10 text-success',
};

export function RuptureLevelBadge({
  level,
  className,
}: {
  level: RuptureLevel;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('font-semibold tracking-wide', STYLES[level], className)}
    >
      {level}
    </Badge>
  );
}

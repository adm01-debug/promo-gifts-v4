import { Clock, Flame, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type UrgencyType =
  | 'ending-soon'
  | 'flash-sale'
  | 'high-demand'
  | 'last-units'
  | 'limited-stock'
  | 'trending';

interface UrgencyBadgeProps {
  type: UrgencyType;
  value?: number | string;
  className?: string;
  animate?: boolean;
}

const urgencyConfig: Record<
  UrgencyType,
  {
    icon: typeof Clock;
    label: string;
    colors: string;
    animation?: string;
  }
> = {
  'limited-stock': {
    icon: AlertTriangle,
    label: 'Estoque Limitado',
    colors: 'bg-warning/15 text-warning border-warning/30',
    animation: 'animate-pulse',
  },
  'ending-soon': {
    icon: Clock,
    label: 'Termina em breve',
    colors: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  trending: {
    icon: TrendingUp,
    label: 'Em Alta',
    colors: 'bg-success/15 text-success border-success/30',
  },
  'flash-sale': {
    icon: Zap,
    label: 'Oferta Relâmpago',
    colors: 'bg-brand-primary/15 text-brand-primary border-brand-primary/30',
    animation: 'animate-pulse',
  },
  'last-units': {
    icon: Flame,
    label: 'Últimas Unidades',
    colors: 'bg-destructive/15 text-destructive border-destructive/30',
    animation: 'animate-bounce-subtle',
  },
  'high-demand': {
    icon: TrendingUp,
    label: 'Alta Demanda',
    colors: 'bg-primary/15 text-primary border-primary/30',
  },
};

export function UrgencyBadge({ type, value, className, animate = true }: UrgencyBadgeProps) {
  const config = urgencyConfig[type];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border px-2.5 py-1 text-xs font-medium',
        config.colors,
        animate && config.animation,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {value ? `${config.label}: ${value}` : config.label}
    </Badge>
  );
}

// Convenience components
export function LimitedStockBadge({ stock, className }: { stock: number; className?: string }) {
  if (stock > 100) return null;
  return <UrgencyBadge type="limited-stock" value={`${stock} un.`} className={className} />;
}

export function TrendingBadge({ className }: { className?: string }) {
  return <UrgencyBadge type="trending" className={className} />;
}

export function FlashSaleBadge({ endsIn, className }: { endsIn?: string; className?: string }) {
  return <UrgencyBadge type="flash-sale" value={endsIn} className={className} />;
}

export function LastUnitsBadge({ units, className }: { units: number; className?: string }) {
  return <UrgencyBadge type="last-units" value={`${units} un.`} className={className} />;
}

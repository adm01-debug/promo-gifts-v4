import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type TrendDirection = 'down' | 'neutral' | 'up';

interface DataCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  trend?: {
    value: number;
    direction?: TrendDirection;
    label?: string;
  };
  variant?: 'danger' | 'default' | 'primary' | 'success' | 'warning';
  size?: 'lg' | 'md' | 'sm';
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: {
    iconBg: 'bg-muted',
    iconColor: 'text-foreground',
  },
  primary: {
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  success: {
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
  },
  warning: {
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
  },
  danger: {
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
  },
};

const sizeStyles = {
  sm: {
    padding: 'p-3',
    iconContainer: 'p-1.5',
    iconSize: 'h-4 w-4',
    value: 'text-lg',
    label: 'text-xs',
  },
  md: {
    padding: 'p-4',
    iconContainer: 'p-2',
    iconSize: 'h-5 w-5',
    value: 'text-2xl',
    label: 'text-sm',
  },
  lg: {
    padding: 'p-6',
    iconContainer: 'p-3',
    iconSize: 'h-6 w-6',
    value: 'text-3xl',
    label: 'text-base',
  },
};

/**
 * DataCard - Card de métricas com suporte a tendências
 *
 * @example
 * <DataCard
 *   icon={Package}
 *   value={1234}
 *   label="Total de Produtos"
 *   trend={{ value: 12, direction: "up" }}
 *   variant="primary"
 * />
 */
export function DataCard({
  icon: Icon,
  value,
  label,
  trend,
  variant = 'default',
  size = 'md',
  className,
  onClick,
}: DataCardProps) {
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  const trendDirection =
    trend?.direction ||
    (trend?.value && trend.value > 0 ? 'up' : trend?.value && trend.value < 0 ? 'down' : 'neutral');

  const TrendIcon =
    trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className={cn('flex items-center gap-3', sizes.padding)}>
        <div className={cn('rounded-md', sizes.iconContainer, styles.iconBg)}>
          <Icon className={cn(sizes.iconSize, styles.iconColor)} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('font-bold tracking-tight', sizes.value)}>
            {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
          </p>
          <div className="flex items-center gap-2">
            <p className={cn('truncate text-muted-foreground', sizes.label)}>{label}</p>
            {trend && (
              <div
                className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  trendDirection === 'up' && 'text-success',
                  trendDirection === 'down' && 'text-destructive',
                  trendDirection === 'neutral' && 'text-muted-foreground',
                )}
              >
                <TrendIcon className="h-3 w-3" aria-hidden="true" />
                <span>{Math.abs(trend.value)}%</span>
                {trend.label && (
                  <span className="font-normal text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Grid wrapper for DataCards
interface DataCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function DataCardGrid({ children, columns = 4, className }: DataCardGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-2 lg:grid-cols-4',
        columns === 5 && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

// Mini Stat Card for compact displays
interface MiniStatCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: 'default' | 'destructive' | 'primary' | 'success' | 'warning';
  className?: string;
}

const colorStyles = {
  default: 'bg-muted/50',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

export function MiniStatCard({
  label,
  value,
  icon,
  color = 'default',
  className,
}: MiniStatCardProps) {
  return (
    <div
      className={cn('flex items-center gap-2 rounded-lg px-3 py-2', colorStyles[color], className)}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-semibold">
          {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
        </p>
      </div>
    </div>
  );
}

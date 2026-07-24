import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatVariant = 'danger' | 'default' | 'info' | 'orange' | 'success' | 'warning';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: StatVariant;
  trend?: {
    value: number;
    label?: string;
  };
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<StatVariant, { bg: string; icon: string; glow: string }> = {
  default: {
    bg: 'bg-muted border-2 border-border',
    icon: 'text-foreground',
    glow: '',
  },
  success: {
    bg: 'bg-success border-2 border-success/30',
    icon: 'text-white',
    glow: 'shadow-sm',
  },
  warning: {
    bg: 'bg-warning border-2 border-warning/30',
    icon: 'text-white',
    glow: 'shadow-sm',
  },
  danger: {
    bg: 'bg-destructive border-2 border-destructive/30',
    icon: 'text-white',
    glow: 'shadow-sm',
  },
  info: {
    bg: 'bg-info border-2 border-info/30',
    icon: 'text-white',
    glow: 'shadow-sm',
  },
  orange: {
    bg: 'bg-primary border-2 border-primary/30',
    icon: 'text-white',
    glow: 'shadow-sm',
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
  className,
  onClick,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300',
        'hover:border-border/80 hover:shadow-lg',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 pt-1">
              <span
                className={cn(
                  'text-xs font-medium',
                  trend.value >= 0 ? 'font-bold text-success' : 'font-bold text-destructive',
                )}
              >
                {trend.value >= 0 ? '+' : ''}
                {trend.value}%
              </span>
              {trend.label && <span className="text-xs text-muted-foreground">{trend.label}</span>}
            </div>
          )}
        </div>

        {/* Icon container with colored background */}
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-all duration-300',
            styles.bg,
            styles.glow,
          )}
        >
          <Icon className={cn('h-6 w-6', styles.icon)} />
        </div>
      </div>

      {/* Subtle gradient overlay */}
      <div
        className={cn(
          'absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10 blur-2xl',
          variant === 'success' && 'bg-success',
          variant === 'warning' && 'bg-warning',
          variant === 'danger' && 'bg-destructive',
          variant === 'info' && 'bg-info',
          variant === 'orange' && 'bg-brand-primary',
        )}
      />
    </div>
  );
}

// Mini stat card for compact displays
interface MiniStatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  variant?: StatVariant;
  className?: string;
}

export function MiniStatCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
  className,
}: MiniStatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all duration-200',
        'hover:border-border/80',
        className,
      )}
    >
      <div
        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', styles.bg)}
      >
        <Icon className={cn('h-4 w-4', styles.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

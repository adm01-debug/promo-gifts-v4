import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Animated counter hook
function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    prevRef.current = target;
    if (from === to) return;

    const start = performance.now();
    let raf: number;

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  variant?: 'default' | 'success' | 'warning' | 'error';
  onClick?: () => void;
  clickHint?: string;
  isActive?: boolean;
  subtitle?: string;
}

const variantStyles = {
  default: {
    base: 'bg-card border-border',
    hover: 'hover:bg-muted/50 hover:shadow-md',
    active: 'ring-primary',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    accentLine: 'bg-primary',
    glowColor: 'shadow-primary/5',
  },
  success: {
    base: 'bg-success/5 border-success/20',
    hover: 'hover:bg-success/10 hover:border-success/40 hover:shadow-md',
    active: 'ring-success',
    iconBg: 'bg-success/15',
    iconColor: 'text-success',
    accentLine: 'bg-success',
    glowColor: 'shadow-success/10',
  },
  warning: {
    base: 'bg-warning/5 border-warning/20',
    hover: 'hover:bg-warning/10 hover:border-warning/40 hover:shadow-md',
    active: 'ring-warning',
    iconBg: 'bg-warning/15',
    iconColor: 'text-warning',
    accentLine: 'bg-warning',
    glowColor: 'shadow-warning/10',
  },
  error: {
    base: 'bg-destructive/5 border-destructive/20',
    hover: 'hover:bg-destructive/10 hover:border-destructive/40 hover:shadow-md',
    active: 'ring-destructive',
    iconBg: 'bg-destructive/15',
    iconColor: 'text-destructive',
    accentLine: 'bg-destructive',
    glowColor: 'shadow-destructive/10',
  },
};

export function StatCard({
  title,
  value,
  icon,
  trend,
  variant = 'default',
  onClick,
  clickHint,
  isActive,
  subtitle,
}: StatCardProps) {
  const styles = variantStyles[variant];

  const numericValue = typeof value === 'string' ? parseInt(value.replace(/\D/g, ''), 10) : value;
  const isNumeric =
    (typeof numericValue === 'number' &&
      !Number.isNaN(numericValue) &&
      typeof value !== 'string') ||
    (typeof value === 'string' && /^\d/.test(value));
  const animatedValue = useCountUp(isNumeric ? numericValue : 0);

  const displayValue = isNumeric ? animatedValue.toLocaleString('pt-BR') : value;

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return (
    <button
      type="button"
      data-testid="stock-stat-card"
      data-stat-slug={slug}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border text-left',
        'transition-all duration-300 ease-out',
        styles.base,
        onClick && 'cursor-pointer',
        styles.hover,
        'active:scale-[0.97]',
        isActive && 'scale-[1.02] shadow-lg ring-2 ring-offset-2 ring-offset-background',
        isActive && styles.active,
        isActive && styles.glowColor,
      )}
      aria-label={`${title}: ${value}${clickHint ? `. ${clickHint}` : ''}`}
      aria-pressed={isActive}
    >
      {/* Top accent line */}
      <div
        className={cn(
          'absolute left-0 right-0 top-0 h-[3px] transition-all duration-300',
          styles.accentLine,
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
        )}
      />

      <div className="px-3 py-2.5 sm:px-4">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 space-y-0.5 text-left sm:space-y-1">
            <p
              data-testid="stock-stat-card-title"
              className="truncate text-[11px] font-medium uppercase leading-tight tracking-wider text-muted-foreground"
            >
              {title}
            </p>
            <p
              data-testid="stock-stat-card-value"
              className="truncate text-xl font-bold tabular-nums leading-tight tracking-tight sm:text-2xl"
            >
              {displayValue}
            </p>
            {subtitle && (
              <p
                data-testid="stock-stat-card-subtitle"
                className="truncate text-[10px] leading-tight text-muted-foreground/70"
              >
                {subtitle}
              </p>
            )}
            {trend && (
              <p
                data-testid="stock-stat-card-trend"
                className={cn(
                  'flex items-center gap-1 text-[11px] font-medium leading-tight sm:text-xs',
                  trend.value >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {trend.value >= 0 ? (
                  <TrendingUp className="h-3 w-3 shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">{trend.label}</span>
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 sm:h-12 sm:w-12',
              isActive ? `${styles.iconBg} shadow-sm` : 'bg-muted/50 group-hover:scale-110',
              styles.iconColor,
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        </div>
      </div>

      {/* Click hint on hover */}
      {clickHint && onClick && (
        <div className="absolute bottom-0 left-0 right-0 pb-1 text-center text-[9px] text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60">
          {clickHint}
        </div>
      )}
    </button>
  );
}

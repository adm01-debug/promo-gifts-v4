import { Card, CardContent } from '@/components/ui/card';
import {
  RefreshCw,
  CalendarPlus,
  CalendarRange,
  CalendarDays,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { useReplenishmentStats, type ReplenishmentStatsDisplay } from '@/hooks/products';
import { cn } from '@/lib/utils';
import { useState, useEffect, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Count Up Animation ─────────────────────────────────────────

function useCountUp(end: number, duration = 800): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (end === 0) {
      setCount(0);
      return;
    }
    let startTime: number | null = null;
    let rafId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - (1 - progress) ** 4;
      setCount(Math.floor(end * easeOutQuart));
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [end, duration]);
  return count;
}

// ─── Stat Card ───────────────────────────────────────────────────

type StatVariant = 'default' | 'info' | 'orange' | 'success' | 'warning';

interface StatCardProps {
  readonly label: string;
  readonly value: number;
  readonly suffix?: string;
  readonly subtitle?: string;
  readonly icon: ReactNode;
  readonly variant: StatVariant;
  readonly delay?: number;
}

const VARIANT_STYLES: Record<StatVariant, { iconBg: string; iconColor: string; glow: string }> = {
  success: {
    iconBg: 'bg-success/15',
    iconColor: 'text-success',
    glow: 'hover:shadow-[0_0_20px_hsl(var(--success)/0.15)]',
  },
  warning: {
    iconBg: 'bg-warning/15',
    iconColor: 'text-warning',
    glow: 'hover:shadow-[0_0_20px_hsl(var(--warning)/0.15)]',
  },
  info: {
    iconBg: 'bg-info/15',
    iconColor: 'text-info',
    glow: 'hover:shadow-[0_0_20px_hsl(var(--info)/0.15)]',
  },
  default: {
    iconBg: 'bg-primary/15',
    iconColor: 'text-primary',
    glow: 'hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]',
  },
  orange: {
    iconBg: 'bg-brand-primary/15',
    iconColor: 'text-brand-primary',
    glow: 'hover:shadow-[0_0_20px_hsl(var(--brand-primary)/0.15)]',
  },
};

function StatCard({
  label,
  value,
  suffix = '',
  subtitle,
  icon,
  variant,
  delay = 0,
}: StatCardProps) {
  const animatedValue = useCountUp(value, 800);
  const styles = VARIANT_STYLES[variant];

  return (
    <Card
      className={cn(
        'border-border/50 transition-all duration-300 hover:border-primary/30',
        styles.glow,
      )}
      style={{ animation: `scale-fade-in 0.4s ease-out ${delay}ms backwards` }}
      role="status"
      aria-label={`${label}: ${value}${suffix}`}
    >
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex items-center gap-2.5">
          <div className={cn('shrink-0 rounded-lg p-2', styles.iconBg)} aria-hidden="true">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold tabular-nums leading-tight sm:text-xl">
              {animatedValue.toLocaleString('pt-BR')}
              {suffix}
            </p>
            <p className="truncate text-[10px] leading-tight text-muted-foreground sm:text-xs">
              {label}
            </p>
            {subtitle && (
              <p className="mt-0.5 truncate text-[9px] leading-tight text-muted-foreground/70">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────

function StatsLoadingSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"
      role="status"
      aria-label="Carregando estatísticas"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Card key={i} className="border-border/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg sm:h-11 sm:w-11" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────

function StatsErrorState() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5" role="alert">
      <Card className="col-span-full border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">
            Erro ao carregar estatísticas. Tente recarregar a página.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function ReplenishmentStatsCards() {
  const { data: stats, isLoading, error } = useReplenishmentStats();

  if (isLoading) return <StatsLoadingSkeleton />;
  if (error) return <StatsErrorState />;

  // FIX TS2322: default object must match all 13 fields of ReplenishmentStatsDisplay
  // (89d2b654 added reorderedThisWeek/Month + upcomingRestockVariants — Cenário B)
  const s: ReplenishmentStatsDisplay = stats ?? {
    totalReplenishments: 0,
    activeReplenishments: 0,
    expiringSoon: 0,
    totalProducts: 0,
    replenishmentRate: 0,
    restockedToday: 0,
    restockedThisWeek: 0,
    restockedLast15Days: 0,
    restockedLast30Days: 0,
    topSupplierName: null,
    topSupplierCount: 0,
    reorderedThisWeek: 0,
    reorderedThisMonth: 0,
    upcomingRestockVariants: 0,
  };

  return (
    <section
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"
      aria-label="Estatísticas de reposição"
    >
      <StatCard
        label="Repostos Hoje"
        value={s.restockedToday}
        subtitle="snapshot diário às 02h"
        icon={<CalendarPlus className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="info"
        delay={0}
      />
      <StatCard
        label="Últimos 7 Dias"
        value={s.restockedThisWeek}
        subtitle={
          s.reorderedThisWeek > 0
            ? `+${s.reorderedThisWeek.toLocaleString('pt-BR')} reabastecidos`
            : undefined
        }
        icon={<CalendarRange className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="success"
        delay={100}
      />
      <StatCard
        label="Últimos 15 Dias"
        value={s.restockedLast15Days}
        subtitle={
          s.reorderedThisMonth > 0
            ? `+${s.reorderedThisMonth.toLocaleString('pt-BR')} reabastecidos`
            : undefined
        }
        icon={<CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="warning"
        delay={150}
      />
      <StatCard
        label="Top Fornecedor"
        value={s.topSupplierCount}
        subtitle={s.topSupplierName ?? '—'}
        icon={<Building2 className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="orange"
        delay={200}
      />
      <StatCard
        label="Reposições Ativas"
        value={s.activeReplenishments}
        suffix={s.replenishmentRate ? ` (${s.replenishmentRate}%)` : ''}
        subtitle={
          s.upcomingRestockVariants > 0
            ? `${s.upcomingRestockVariants.toLocaleString('pt-BR')} variantes aguardam lote`
            : undefined
        }
        icon={<RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="default"
        delay={300}
      />
    </section>
  );
}

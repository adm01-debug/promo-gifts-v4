import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  CalendarPlus,
  CalendarRange,
  CalendarDays,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useNoveltyStats, type NoveltyStatsDisplay } from '@/hooks/products';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';

/**
 * ISSUE-28 FIX: animated count-up que começa do valor ATUAL exibido (não de 0)
 * quando o `end` muda. Isso evita reiniciar do zero na atualização de stats, que
 * causava um efeito visualmente abrupto ao fazer refresh dos cards após 5 minutos.
 */
function useCountUp(end: number, duration = 800) {
  const [count, setCount] = useState(0);
  // Rastreia o valor atual exibido para usar como ponto de partida da próxima animação.
  const countRef = useRef(0);
  countRef.current = count;

  useEffect(() => {
    const startValue = countRef.current;
    if (startValue === end) return; // sem mudança — não reinicia animação
    let startTime: number | null = null;
    let rafId: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - (1 - progress) ** 4;
      setCount(Math.round(startValue + (end - startValue) * easeOutQuart));
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [end, duration]);
  return count;
}

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  subtitle?: string;
  icon: React.ReactNode;
  variant: 'success' | 'warning' | 'info' | 'default' | 'orange';
  delay?: number;
}

const variantStyles = {
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
  const styles = variantStyles[variant];

  return (
    <Card
      className={cn(
        'border-border/50 transition-all duration-300 hover:border-primary/30',
        styles.glow,
      )}
      style={{ animation: `scale-fade-in 0.4s ease-out ${delay}ms backwards` }}
    >
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex items-center gap-2.5">
          <div className={cn('shrink-0 rounded-lg p-2', styles.iconBg)}>{icon}</div>
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

export function NoveltyStatsCards() {
  const {
    data: stats,
    isLoading,
    error,
  } = useNoveltyStats() as {
    data: NoveltyStatsDisplay | undefined;
    isLoading: boolean;
    error: Error | null;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-lg sm:h-11 sm:w-11" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    logger.error('Erro ao carregar estatísticas:', error);
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-border/50 border-destructive/20">
            <CardContent className="p-2.5 sm:p-3">
              <div className="flex items-center gap-2.5">
                <div className="shrink-0 rounded-lg bg-destructive/10 p-2">
                  <AlertCircle className="h-4 w-4 text-destructive/70 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold tabular-nums leading-tight text-muted-foreground sm:text-xl">
                    —
                  </p>
                  <p className="truncate text-[10px] leading-tight text-muted-foreground/60 sm:text-xs">
                    Indisponível
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <StatCard
        label="Chegaram Hoje"
        value={stats?.arrivedToday || 0}
        icon={<CalendarPlus className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="orange"
        delay={0}
      />
      <StatCard
        label="Últimos 7 Dias"
        value={stats?.arrivedThisWeek || 0}
        icon={<CalendarRange className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="success"
        delay={100}
      />
      <StatCard
        label="Últimos 15 Dias"
        value={stats?.arrivedLast15Days || 0}
        icon={<CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="warning"
        delay={150}
      />
      <StatCard
        label="Top Fornecedor"
        value={stats?.topSupplierCount || 0}
        subtitle={stats?.topSupplierName || '—'}
        icon={<Building2 className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="info"
        delay={200}
      />
      <StatCard
        label="Novidades Ativas"
        value={stats?.activeNovelties || 0}
        suffix={stats?.noveltyRate ? ` (${stats.noveltyRate}%)` : ''}
        icon={<Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="default"
        delay={300}
      />
    </div>
  );
}

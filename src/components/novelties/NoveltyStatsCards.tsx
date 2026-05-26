import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, CalendarPlus, CalendarRange, CalendarDays, Building2 } from "lucide-react";
import { useNoveltyStats } from "@/hooks/products";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function useCountUp(end: number, duration: number = 800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (end === 0) { setCount(0); return; }
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(end * easeOutQuart));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);
  return count;
}

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  subtitle?: string;
  icon: React.ReactNode;
  variant: "success" | "warning" | "info" | "default" | "orange";
  delay?: number;
}

const variantStyles = {
  success: { iconBg: "bg-success/15", iconColor: "text-success", glow: "hover:shadow-[0_0_20px_hsl(var(--success)/0.15)]" },
  warning: { iconBg: "bg-warning/15", iconColor: "text-warning", glow: "hover:shadow-[0_0_20px_hsl(var(--warning)/0.15)]" },
  info: { iconBg: "bg-info/15", iconColor: "text-info", glow: "hover:shadow-[0_0_20px_hsl(var(--info)/0.15)]" },
  default: { iconBg: "bg-primary/15", iconColor: "text-primary", glow: "hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]" },
  orange: { iconBg: "bg-brand-primary/15", iconColor: "text-brand-primary", glow: "hover:shadow-[0_0_20px_hsl(var(--brand-primary)/0.15)]" },
};

function StatCard({ label, value, suffix = "", subtitle, icon, variant, delay = 0 }: StatCardProps) {
  const animatedValue = useCountUp(value, 800);
  const styles = variantStyles[variant];

  return (
    <Card
      className={cn(
        "border-border/50 hover:border-primary/30 transition-all duration-300",
        styles.glow
      )}
      style={{ animation: `scale-fade-in 0.4s ease-out ${delay}ms backwards` }}
    >
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("shrink-0 p-2 rounded-lg", styles.iconBg)}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg sm:text-xl font-bold tabular-nums truncate leading-tight">
              {animatedValue.toLocaleString('pt-BR')}{suffix}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate leading-tight">
              {label}
            </p>
            {subtitle && (
              <p className="text-[9px] text-muted-foreground/70 truncate mt-0.5 leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg shimmer" />
          <div className="space-y-2">
            <div className="h-6 w-16 rounded shimmer" style={{ animationDelay: '100ms' }} />
            <div className="h-4 w-24 rounded shimmer" style={{ animationDelay: '200ms' }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function NoveltyStatsCards() {
  const { data: stats, isLoading, error } = useNoveltyStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1">
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
    console.error('Erro ao carregar estatísticas:', error);
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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
        subtitle={stats?.topSupplierName || "—"}
        icon={<Building2 className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="info"
        delay={200}
      />
      <StatCard
        label="Novidades Ativas"
        value={stats?.activeNovelties || 0}
        suffix={stats?.noveltyRate ? ` (${stats.noveltyRate}%)` : ""}
        icon={<Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="default"
        delay={300}
      />
    </div>
  );
}

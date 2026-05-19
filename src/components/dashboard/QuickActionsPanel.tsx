import { useEffect, useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  FilePlus,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  FileText,
  ArrowRight,
  DollarSign,
  Target,
  BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuotes, Quote } from "@/hooks/quotes";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function QuickActionsPanel() {
  const navigate = useNavigate();
  const { quotes, isLoading } = useQuotes();
  const { user } = useAuth();

  const stats = useMemo(() => {
    if (!quotes.length) return { pending: 0, approved: 0, rejected: 0, monthTotal: 0, monthCount: 0, conversionRate: 0 };

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const monthQuotes = quotes.filter((q) => {
      try {
        const d = parseISO(q.created_at || "");
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      } catch {
        return false;
      }
    });

    const pending = quotes.filter((q) => q.status === "pending" || q.status === "sent").length;
    const approved = monthQuotes.filter((q) => q.status === "approved").length;
    const rejected = monthQuotes.filter((q) => q.status === "rejected").length;
    const monthTotal = monthQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
    const decidedCount = approved + rejected;
    const conversionRate = decidedCount > 0 ? Math.round((approved / decidedCount) * 100) : 0;

    return { pending, approved, rejected, monthTotal, monthCount: monthQuotes.length, conversionRate };
  }, [quotes]);

  const quickActions = [
    {
      label: "Novo Orçamento",
      icon: FilePlus,
      onClick: () => navigate("/orcamentos/novo"),
      variant: "default" as const,
    },
    {
      label: "Pendentes de Aprovação",
      icon: Clock,
      onClick: () => navigate("/orcamentos"),
      badge: stats.pending > 0 ? stats.pending : undefined,
      variant: "outline" as const,
    },
    {
      label: "Catálogo",
      icon: BarChart3,
      onClick: () => navigate("/"),
      variant: "outline" as const,
    },
  ];

  const metricCards = [
    {
      label: "Orçamentos no Mês",
      value: stats.monthCount.toString(),
      icon: FileText,
      color: "text-primary",
    },
    {
      label: "Valor Total (Mês)",
      value: formatCurrency(stats.monthTotal),
      icon: DollarSign,
      color: "text-primary",
    },
    {
      label: "Taxa de Conversão",
      value: `${stats.conversionRate}%`,
      icon: Target,
      color: "text-warning",
    },
    {
      label: "Aprovados / Rejeitados",
      value: `${stats.approved} / ${stats.rejected}`,
      icon: TrendingUp,
      color: "text-primary",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div>
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 relative"
              onClick={action.onClick}
            >
              <action.icon className="h-5 w-5" />
              <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
              {action.badge && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1.5 -right-1.5 h-5 min-w-5 flex items-center justify-center text-[10px] px-1.5"
                >
                  {action.badge}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div>
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Suas Métricas do Mês
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metricCards.map((metric) => (
            <Card key={metric.label} className="border-border/50">
              <CardContent className="p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                  <span className="text-xs text-muted-foreground truncate">{metric.label}</span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-6 w-16 mt-0.5" /> : metric.value}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

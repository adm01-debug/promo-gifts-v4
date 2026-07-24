import { PieChart, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSegmentAnalysis } from '@/hooks/intelligence';

export function SegmentAnalysis({
  days = 30,
  categoryId,
  supplierId,
}: {
  days?: number;
  categoryId?: string | null;
  supplierId?: string | null;
}) {
  const { data: segments, isLoading } = useSegmentAnalysis(days, categoryId, supplierId);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(v);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!segments?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sem dados de segmentos ainda.</p>
        </CardContent>
      </Card>
    );
  }

  const maxRevenue = Math.max(...segments.map((s) => s.revenue));

  // Opacity-based approach: all bars use primary color with decreasing opacity
  const getOpacity = (i: number) => Math.max(1 - i * 0.08, 0.4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="skin-icon flex h-7 w-7 items-center justify-center rounded-lg">
            <PieChart className="h-3.5 w-3.5" />
          </div>
          🎯 Top Clientes por Faturamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {segments.map((segment, i) => {
          const percentage = maxRevenue > 0 ? (segment.revenue / maxRevenue) * 100 : 0;
          return (
            <div key={segment.segment} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="mr-2 flex-1 truncate font-medium">{segment.segment}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {segment.orderCount} pedidos · {formatCurrency(segment.revenue)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    background: `hsl(var(--primary) / ${getOpacity(i)})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

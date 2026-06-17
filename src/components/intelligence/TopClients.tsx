import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTopClients } from '@/hooks/intelligence';

export function TopClients({
  days = 30,
  categoryId,
  supplierId,
}: {
  days?: number;
  categoryId?: string | null;
  supplierId?: string | null;
}) {
  const { data: clients, isLoading } = useTopClients(days, categoryId, supplierId);

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
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!clients?.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="skin-icon flex h-7 w-7 items-center justify-center rounded-lg">
              <Users className="h-3.5 w-3.5" />
            </div>
            🏆 Top Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
        </CardContent>
      </Card>
    );
  }

  const maxRevenue = Math.max(...clients.map((c) => c.revenue));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="skin-icon flex h-7 w-7 items-center justify-center rounded-lg">
            <Users className="h-3.5 w-3.5" />
          </div>
          🏆 Top Clientes por Faturamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {clients.map((client, i) => {
          const pct = maxRevenue > 0 ? (client.revenue / maxRevenue) * 100 : 0;
          return (
            <div key={client.clientName + i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="mr-2 flex-1 truncate">
                  <span className="font-medium">{client.clientName}</span>
                  {client.company && client.company !== client.clientName && (
                    <span className="ml-1 text-xs text-muted-foreground">({client.company})</span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs font-semibold text-foreground">
                    {formatCurrency(client.revenue)}
                  </span>
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ({client.orderCount} ped.)
                  </span>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="skin-progress h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

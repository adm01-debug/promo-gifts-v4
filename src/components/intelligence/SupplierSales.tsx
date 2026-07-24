import { Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupplierSales } from '@/hooks/intelligence';
import { cn } from '@/lib/utils';
import { IntelligenceEmptyState } from './IntelligenceEmptyState';

export function SupplierSales({
  days = 30,
  categoryId,
  supplierId,
  productId,
  categoryName,
}: {
  days?: number;
  categoryId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  categoryName?: string | null;
}) {
  const { data: suppliers, isLoading } = useSupplierSales(days, categoryId, supplierId, productId);

  const hasData = !!suppliers?.length;
  const supplierRows = suppliers ?? [];

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

  const maxRevenue = hasData ? Math.max(...supplierRows.map((s) => s.revenue)) : 0;
  const totalRevenue = hasData ? supplierRows.reduce((s, su) => s + su.revenue, 0) : 0;

  // Use opacity-based approach so bars follow the skin
  const getBarOpacity = (i: number) => Math.max(1 - i * 0.07, 0.4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="skin-icon flex h-7 w-7 items-center justify-center rounded-lg">
                <Truck className="h-3.5 w-3.5" />
              </div>
              📦 Vendas por Fornecedor
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {categoryName ? `Fornecedores de "${categoryName}"` : 'Faturamento por fornecedor'} ·{' '}
              {days} dias
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {!hasData ? (
          <IntelligenceEmptyState
            title="Sem vendas por fornecedor"
            description={
              categoryName
                ? `Nenhum fornecedor com vendas em "${categoryName}".`
                : 'Nenhum fornecedor registrou vendas neste período.'
            }
          />
        ) : (
          supplierRows.map((supplier, i) => {
            const pct = maxRevenue > 0 ? (supplier.revenue / maxRevenue) * 100 : 0;
            const share =
              totalRevenue > 0 ? ((supplier.revenue / totalRevenue) * 100).toFixed(1) : '0';
            return (
              <div key={supplier.supplierName + i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="mr-2 flex flex-1 items-center gap-2 truncate">
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        i < 3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate text-xs font-medium">{supplier.supplierName}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    <Badge variant="outline" className="px-1 py-0 text-[9px]">
                      {share}%
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">
                      {formatCurrency(supplier.revenue)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `hsl(var(--primary) / ${getBarOpacity(i)})`,
                      }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-[9px] text-muted-foreground">
                    {supplier.productCount} prod. · {supplier.orderCount} it.
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

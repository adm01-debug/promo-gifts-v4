import { TrendingUp, TrendingDown, Minus, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrendingProducts } from '@/hooks/intelligence';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { IntelligenceEmptyState } from './IntelligenceEmptyState';

export function TrendingProducts({
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
  const { data: products, isLoading } = useTrendingProducts(
    days,
    categoryId,
    supplierId,
    productId,
    7,
  );
  const navigate = useNavigate();

  const formatCurrency = (v: number | null | undefined) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  const trendIcon = {
    up: <TrendingUp className="h-3 w-3 text-primary" />,
    down: <TrendingDown className="h-3 w-3 text-destructive" />,
    stable: <Minus className="h-3 w-3 text-muted-foreground" />,
  };

  const hasData = !!products?.length;
  const visibleProducts = products ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-primary to-warning">
                <TrendingUp className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              🔥 Produtos em Alta
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {categoryName ? `Top em "${categoryName}"` : 'Top 7 por faturamento'} · {days} dias
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!hasData ? (
          <IntelligenceEmptyState
            title="Nenhum produto em alta"
            description={
              categoryName
                ? `Sem vendas registradas em "${categoryName}" no período.`
                : 'Sem vendas registradas para o período selecionado.'
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {visibleProducts.map((product, index) => (
              <div
                key={product.productSku || product.productId}
                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
                onClick={() => product.productId && navigate(`/produto/${product.productId}`)}
              >
                {/* Rank */}
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    index === 0 && 'bg-warning/20 text-warning',
                    index === 1 && 'bg-muted/50 text-muted-foreground',
                    index === 2 && 'bg-brand-primary/20 text-brand-primary',
                    index > 2 && 'bg-muted text-muted-foreground',
                  )}
                >
                  {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                </span>

                {/* Image */}
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted">
                  {product.productImage ? (
                    <img
                      src={product.productImage}
                      alt="Imagem do produto"
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{product.productName}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {/* FIX: null-guard — totalQuantity pode vir null antes de estabilizar */}
                    <span>{(product.totalQuantity ?? 0).toLocaleString('pt-BR')} un.</span>
                    <span>·</span>
                    <span>{product.orderCount} ped.</span>
                  </div>
                </div>

                {/* Revenue + Trend */}
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold">{formatCurrency(product.totalRevenue)}</p>
                  <div className="flex items-center justify-end gap-1">
                    {trendIcon[product.trend]}
                    <span className="text-[9px] text-muted-foreground">
                      {product.conversionRate}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

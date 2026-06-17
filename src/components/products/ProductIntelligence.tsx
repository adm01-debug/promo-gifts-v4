import { BarChart3, Package, Target, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useProductInsights } from '@/hooks/products/useProductInsights';
import { useProductRecommendations } from '@/hooks/products/useProductRecommendations';
import { cn } from '@/lib/utils';

interface ProductIntelligenceProps {
  productId?: string;
  productSku?: string;
  productName?: string;
}

export function ProductIntelligence({
  productId,
  productSku,
  productName: _productName,
}: ProductIntelligenceProps) {
  const navigate = useNavigate();
  const { data: insights, isLoading: insightsLoading } = useProductInsights(productId, productSku);
  const { frequentlyBoughtTogether } = useProductRecommendations(productId, productSku);

  if (insightsLoading) {
    return <ProductIntelligenceSkeleton />;
  }

  const hasData = insights && (insights.totalViews > 0 || insights.totalOrders > 0);

  return (
    <div className="space-y-3">
      {/* Header compacto */}
      <div className="flex items-center gap-2">
        <div className="skin-icon flex h-7 w-7 items-center justify-center rounded-lg">
          <BarChart3 className="h-3.5 w-3.5" />
        </div>
        <div>
          <h2 className="font-display text-sm font-semibold text-foreground">
            Inteligência do Produto
          </h2>
          <p className="text-[11px] leading-none text-muted-foreground">
            Dados e insights baseados em histórico real
          </p>
        </div>
      </div>

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="mb-1 font-display text-sm font-semibold">Ainda não há dados</h3>
            <p className="max-w-xs text-xs text-muted-foreground">
              Conforme o produto for visualizado e cotado, insights aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Métrica de conversão */}
          <div className="grid grid-cols-1 gap-2">
            <MetricCard
              icon={Target}
              label="Conversão"
              value={`${insights?.conversionRate || 0}%`}
              color="purple"
            />
          </div>
        </>
      )}

      {/* Frequentemente Comprados Juntos */}
      {frequentlyBoughtTogether.data && frequentlyBoughtTogether.data.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs font-medium text-muted-foreground">Comprados Juntos</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {frequentlyBoughtTogether.data.map((product) => (
                <div
                  key={product.productSku || product.productId}
                  className="group w-16 flex-shrink-0 cursor-pointer"
                  onClick={() => product.productId && navigate(`/produto/${product.productId}`)}
                >
                  <div className="h-16 w-16 overflow-hidden rounded-lg border border-border/50 bg-muted transition-colors group-hover:border-primary/30">
                    {product.productImage ? (
                      <img
                        src={product.productImage}
                        alt={product.productName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10px]">{product.productName}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const METRIC_CARD_ICON_COLORS = {
  blue: 'text-primary',
  amber: 'text-warning',
  green: 'text-success',
  purple: 'text-primary/70',
} as const;

const METRIC_CARD_BG_COLORS = {
  blue: 'bg-primary/10',
  amber: 'bg-warning/10',
  green: 'bg-success/10',
  purple: 'bg-primary/10',
} as const;

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: 'blue' | 'amber' | 'green' | 'purple';
}

function MetricCard({ icon: Icon, label, value, color }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-2.5">
        <div
          className={cn(
            'mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg',
            METRIC_CARD_BG_COLORS[color],
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', METRIC_CARD_ICON_COLORS[color])} />
        </div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ProductIntelligenceSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <div>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-1 h-3 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="p-2.5">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="mt-1.5 h-5 w-10" />
              <Skeleton className="mt-1 h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

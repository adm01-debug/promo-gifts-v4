import { DollarSign, ShoppingCart, Receipt, TrendingUp, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/ui/kpi-card';
import { useCommercialKPIs } from '@/hooks/intelligence';

interface Props {
  days: number;
  categoryId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  categoryName?: string | null;
  supplierName?: string | null;
}

export function IntelligenceKPICards({
  days,
  categoryId,
  supplierId,
  productId,
  categoryName,
  supplierName,
}: Props) {
  const { data: kpis, isLoading } = useCommercialKPIs(days, categoryId, supplierId, productId);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(v);

  const filterLabel = categoryName || supplierName || null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!kpis) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="py-4">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Resumo</span>
          {filterLabel && (
            <Badge
              variant="outline"
              className="border-primary/30 px-1.5 py-0 text-[10px] text-primary"
            >
              {filterLabel}
            </Badge>
          )}
          <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px]">
            {days} dias
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard
            icon={DollarSign}
            label="Faturamento"
            value={formatCurrency(kpis.totalRevenue)}
            sub={`${formatCurrency(kpis.revenueThisMonth)} este mês`}
            highlight
            tooltip="Soma do total de todos os pedidos confirmados no período selecionado. Inclui descontos aplicados, exclui cancelados."
            animationDelay={0}
          />
          <KpiCard
            icon={ShoppingCart}
            label="Pedidos"
            value={String(kpis.totalOrders)}
            sub={`${kpis.ordersThisMonth} este mês`}
            tooltip="Quantidade de pedidos criados no período. Cada pedido representa uma venda efetiva (orçamento que virou pedido)."
            animationDelay={50}
          />
          <KpiCard
            icon={Receipt}
            label="Orçamentos"
            value={String(kpis.totalQuotes)}
            sub={`${kpis.quotesThisMonth} este mês`}
            tooltip="Quantidade de orçamentos criados no período (em qualquer status: rascunho, enviado, aprovado, etc.)."
            animationDelay={100}
          />
          <KpiCard
            icon={TrendingUp}
            label="Conversão"
            value={`${kpis.conversionRate}%`}
            sub="orçamento → pedido"
            highlight={kpis.conversionRate >= 50}
            warning={kpis.conversionRate > 0 && kpis.conversionRate < 30}
            alert={kpis.conversionRate === 0 && kpis.totalQuotes > 0}
            tooltip="Percentual de orçamentos que viraram pedidos. Calculado como: (pedidos ÷ orçamentos) × 100. Verde ≥ 50%, amarelo < 30%."
            animationDelay={150}
          />
          <KpiCard
            icon={DollarSign}
            label="Ticket Médio"
            value={formatCurrency(kpis.averageTicket)}
            sub="por pedido"
            tooltip="Valor médio por pedido. Calculado como faturamento total dividido pela quantidade de pedidos."
            animationDelay={200}
          />
        </div>
      </CardContent>
    </Card>
  );
}

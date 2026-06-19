/**
 * ClientOverview360 — KPIs (LTV, ticket médio, última compra) com toggle "Trimestre atual vs anterior".
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useClientBI } from '@/hooks/bi/useClientBI';
import { KPIsSkeleton } from '@/components/bi/BISkeletons';
import { cn } from '@/lib/utils';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

interface Props {
  clientId: string;
}

function DeltaPill({ pct }: { pct: number }) {
  const positive = pct >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const cls = positive ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold',
        cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(Math.round(pct))}%
    </span>
  );
}

export function ClientOverview360({ clientId }: Props) {
  const bi = useClientBI(clientId);
  const [comparePeriod, setComparePeriod] = useState(false);

  if (bi.isLoading) return <KPIsSkeleton />;

  const recencyTone =
    bi.daysSinceLastOrder === null
      ? 'secondary'
      : bi.daysSinceLastOrder < 30
        ? 'default'
        : bi.daysSinceLastOrder < 90
          ? 'secondary'
          : 'destructive';

  const recencyLabel =
    bi.daysSinceLastOrder === null
      ? 'Nunca comprou'
      : bi.daysSinceLastOrder === 0
        ? 'Hoje'
        : `${bi.daysSinceLastOrder}d atrás`;

  // Quando o toggle está ativo: mostrar valores do período corrente (90d) com delta
  const displayLtv = comparePeriod ? bi.current90d.ltv : bi.ltv;
  const displayTicket = comparePeriod ? bi.current90d.avgTicket : bi.avgTicket;
  const displayOrders = comparePeriod ? bi.current90d.ordersCount : bi.ordersCount;
  const showDeltas = comparePeriod && bi.delta.hasPreviousData;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {bi.isMock ? (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Sparkles className="h-3 w-3" /> Dados simulados · em breve dados reais
          </Badge>
        ) : (
          <span />
        )}
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Switch
            checked={comparePeriod}
            onCheckedChange={setComparePeriod}
            aria-label="Comparar período"
          />
          <span className="font-medium text-foreground">
            {comparePeriod ? '90d atual vs 90d anteriores' : 'Histórico total'}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-[1.5px] transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {comparePeriod ? 'Receita 90d' : 'LTV Total'}
              </span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2">
              <div className="font-display text-3xl font-bold">{fmtBRL(displayLtv)}</div>
              {showDeltas && <DeltaPill pct={bi.delta.ltvDeltaPct} />}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {comparePeriod
                ? `vs ${fmtBRL(bi.previous90d.ltv)} no período anterior`
                : `${bi.ordersCount} pedido${bi.ordersCount !== 1 ? 's' : ''} no histórico`}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[1.5px] transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ticket Médio{comparePeriod && ' · 90d'}
              </span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2">
              <div className="font-display text-3xl font-bold">{fmtBRL(displayTicket)}</div>
              {showDeltas && <DeltaPill pct={bi.delta.avgTicketDeltaPct} />}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {comparePeriod
                ? `vs ${fmtBRL(bi.previous90d.avgTicket)} antes`
                : 'por pedido fechado'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[1.5px] transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {comparePeriod ? 'Pedidos 90d' : 'Última Compra'}
              </span>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            {comparePeriod ? (
              <>
                <div className="flex items-baseline gap-2">
                  <div className="font-display text-3xl font-bold">{displayOrders}</div>
                  {showDeltas && <DeltaPill pct={bi.delta.ordersCountDeltaPct} />}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  vs {bi.previous90d.ordersCount} no período anterior
                </div>
              </>
            ) : (
              <>
                <div className="font-display text-2xl font-bold">
                  {bi.lastOrderDate ? fmtDate(bi.lastOrderDate) : '—'}
                </div>
                <Badge variant={recencyTone} className="mt-2">
                  {recencyLabel}
                </Badge>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

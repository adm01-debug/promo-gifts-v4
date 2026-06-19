/**
 * ClientComparator — comparação lado-a-lado de até 3 clientes.
 * Tabela: Health Score, LTV, ticket, frequência, top categoria, próxima janela.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertTriangle, X, Trophy, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSingleClientComparisonRow,
  type ClientComparisonRow,
} from '@/hooks/bi/useClientsComparison';

interface Props {
  clientIds: string[]; // 1-3
  onRemove: (id: string) => void;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function tierBadge(tier: ClientComparisonRow['tier']) {
  switch (tier) {
    case 'healthy':
      return {
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
        icon: CheckCircle2,
        label: 'Saudável',
      };
    case 'attention':
      return {
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
        icon: AlertTriangle,
        label: 'Atenção',
      };
    case 'risk':
      return {
        color: 'text-red-600 dark:text-red-400 bg-red-500/10',
        icon: AlertTriangle,
        label: 'Risco',
      };
    case 'unknown':
    default:
      return { color: 'text-muted-foreground bg-muted', icon: Minus, label: '—' };
  }
}

function ClientColumn({ clientId, onRemove }: { clientId: string; onRemove: () => void }) {
  const row = useSingleClientComparisonRow(clientId);
  const tier = tierBadge(row.tier);
  const TierIcon = tier.icon;

  if (row.isLoading) {
    return (
      <div className="min-w-[240px] flex-1 space-y-3 p-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  return (
    <div className="relative min-w-[240px] flex-1 space-y-3 border-l p-4 first:border-l-0">
      <button
        onClick={onRemove}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        aria-label="Remover"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div>
        <h4 className="pr-6 font-display text-sm font-semibold">{row.clientName}</h4>
        {row.ramoAtividade && (
          <Badge variant="secondary" className="mt-1 text-[10px]">
            {row.ramoAtividade}
          </Badge>
        )}
      </div>
      <div
        className={cn('flex items-center gap-3 rounded-xl p-3', tier.color.split(' ').slice(-1)[0])}
      >
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl border-[1.5px] bg-background/80">
          <span
            className={cn(
              'font-display text-2xl font-bold leading-none',
              tier.color.split(' ')[0],
              tier.color.split(' ')[1],
            )}
          >
            {row.score}
          </span>
          <span className="mt-0.5 text-[8px] uppercase tracking-wider text-muted-foreground">
            Score
          </span>
        </div>
        <Badge variant="outline" className={cn('gap-1 border-0', tier.color)}>
          <TierIcon className="h-3 w-3" />
          {tier.label}
        </Badge>
      </div>
      <dl className="space-y-2 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">LTV</dt>
          <dd className="font-medium tabular-nums">{fmtBRL(row.ltv)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Ticket médio</dt>
          <dd className="font-medium tabular-nums">{fmtBRL(row.avgTicket)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Pedidos</dt>
          <dd className="font-medium tabular-nums">{row.ordersCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Última compra</dt>
          <dd className="font-medium tabular-nums">
            {row.daysSinceLastOrder !== null ? `${row.daysSinceLastOrder}d` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Top categoria</dt>
          <dd className="max-w-[120px] truncate font-medium" title={row.topCategory ?? '—'}>
            {row.topCategory ?? '—'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Categoria favorita</dt>
          <dd
            className="flex max-w-[140px] items-center gap-1.5 truncate font-medium"
            title={row.favoriteCategoryLabel ?? '—'}
          >
            {row.favoriteCategoryLabel ? (
              <>
                <span className="truncate">{row.favoriteCategoryLabel}</span>
                <Badge
                  variant="outline"
                  className="h-4 shrink-0 border-emerald-500/30 bg-emerald-500/10 px-1 text-[9px] tabular-nums text-emerald-700 dark:text-emerald-300"
                >
                  {row.favoriteCategorySharePct}%
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Categoria oportunidade</dt>
          <dd
            className="flex max-w-[140px] items-center gap-1.5 truncate font-medium"
            title={row.opportunityCategoryLabel ?? '—'}
          >
            {row.opportunityCategoryLabel ? (
              <>
                <span className="truncate">{row.opportunityCategoryLabel}</span>
                <Badge
                  variant="outline"
                  className="h-4 shrink-0 border-violet-500/30 bg-violet-500/10 px-1 text-[9px] tabular-nums text-violet-700 dark:text-violet-300"
                >
                  setor {row.opportunityCategorySharePct}%
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Próximo pico</dt>
          <dd className="font-medium">{row.nextPeakLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Share-of-wallet</dt>
          <dd className="font-medium tabular-nums">{row.shareOfWalletPct}%</dd>
        </div>
      </dl>
    </div>
  );
}

export function ClientComparator({ clientIds, onRemove }: Props) {
  if (clientIds.length === 0) {
    return (
      <Card className="border-[1.5px] border-dashed">
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          Adicione clientes para começar a comparação.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[1.5px]">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b p-4">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">
            Comparação · {clientIds.length} {clientIds.length === 1 ? 'cliente' : 'clientes'}
          </h3>
        </div>
        <div className="flex flex-col overflow-x-auto md:flex-row">
          {clientIds.map((id) => (
            <ClientColumn key={id} clientId={id} onRemove={() => onRemove(id)} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

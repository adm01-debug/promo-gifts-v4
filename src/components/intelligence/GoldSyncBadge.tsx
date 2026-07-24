import { Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useGoldSyncStatus } from '@/hooks/intelligence/useGoldSyncStatus';
import { cn } from '@/lib/utils';

interface GoldSyncBadgeProps {
  /** Janela em dias em análise (para explicar KPIs zerados). */
  windowDays: number;
  className?: string;
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `há ${diffD}d`;
  const diffMo = Math.floor(diffD / 30);
  if (diffMo < 12) return `há ${diffMo} meses`;
  return `há ${Math.floor(diffMo / 12)} anos`;
}

/**
 * Chip que expõe o "heartbeat" do Gold: última venda/orçamento registrado.
 * Serve para explicar, sem ambiguidade, quando KPIs aparecem em zero:
 * — verde: houve pedido dentro da janela analisada.
 * — âmbar: sem pedido no período, mas Gold acessível (há histórico).
 * — cinza: nenhuma venda registrada ainda.
 */
export function GoldSyncBadge({ windowDays, className }: GoldSyncBadgeProps) {
  const { data, isLoading, isError } = useGoldSyncStatus();

  if (isLoading) {
    return <Skeleton className={cn('h-6 w-40 rounded-full', className)} />;
  }

  if (isError || !data) {
    return (
      <span
        data-testid="gold-sync-badge"
        data-state="error"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive',
          className,
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Gold indisponível
      </span>
    );
  }

  const inWindow = data.hasOrdersInWindow(windowDays);
  const state: 'in-window' | 'stale' | 'empty' = !data.lastOrderAt
    ? 'empty'
    : inWindow
      ? 'in-window'
      : 'stale';

  const styles = {
    'in-window': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    stale: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    empty: 'border-border bg-muted/40 text-muted-foreground',
  }[state];

  const Icon = state === 'in-window' ? CheckCircle2 : state === 'stale' ? AlertTriangle : Database;

  const label =
    state === 'empty'
      ? 'Gold · sem pedidos'
      : state === 'in-window'
        ? `Gold · sincronizado ${formatRelative(data.lastActivityAt ?? data.lastOrderAt!)}`
        : `Gold · última venda ${formatRelative(data.lastOrderAt!)}`;

  const tooltip =
    state === 'empty'
      ? 'Nenhum pedido registrado no banco Gold ainda. Os KPIs zerados refletem a ausência de vendas — não uma falha de sincronização.'
      : state === 'in-window'
        ? `Última atividade comercial em ${data.lastActivityAt?.toLocaleString('pt-BR')}. O Gold está atualizado dentro da janela de ${windowDays} dias.`
        : `Última venda em ${data.lastOrderAt?.toLocaleDateString('pt-BR')} — fora da janela de ${windowDays} dias. Por isso o card mostra 0 pedidos: não houve venda no período, mas os dados existem no Gold.`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-testid="gold-sync-badge"
            data-state={state}
            className={cn(
              'inline-flex cursor-help items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              styles,
              className,
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * ZoneRefreshButton — Onda 14
 *
 * Botão compacto para refresh local de uma zona do hub de Conexões.
 * Invalida apenas as queryKeys relevantes da zona via React Query e
 * opcionalmente dispara um callback (ex: bumpar um signal para componentes
 * que não usam React Query, como ConnectionsOverviewTable).
 *
 * Estado de loading sincroniza com isFetching das queries afetadas.
 */
import { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface ZoneRefreshButtonProps {
  /** Lista de queryKeys (prefix match) que serão invalidadas */
  queryKeys: ReadonlyArray<readonly unknown[]>;
  /** Texto curto do tooltip (ex: "Atualizar zona Saúde") */
  label: string;
  /** Disparado depois da invalidação — útil para bumpar signals locais */
  onRefresh?: () => void;
  /** Mensagem de toast ao concluir; se omitido, não exibe toast */
  successMessage?: string;
  className?: string;
}

export function ZoneRefreshButton({
  queryKeys,
  label,
  onRefresh,
  successMessage,
  className,
}: ZoneRefreshButtonProps) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  // isFetching agregado para qualquer uma das queryKeys da zona
  const fetchingCount = useIsFetching({
    predicate: (q) => queryKeys.some((target) => target.every((seg, i) => q.queryKey[i] === seg)),
  });
  const isLoading = pending || fetchingCount > 0;

  const handleClick = useCallback(async () => {
    setPending(true);
    try {
      await Promise.all(
        queryKeys.map((key) => qc.invalidateQueries({ queryKey: key as unknown[] })),
      );
      onRefresh?.();
      if (successMessage) toast.success(successMessage, { duration: 2000 });
    } finally {
      // Pequeno delay para o spinner não desaparecer instantaneamente
      window.setTimeout(() => setPending(false), 250);
    }
  }, [qc, queryKeys, onRefresh, successMessage]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            disabled={isLoading}
            aria-label={label}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground',
              'transition-colors hover:bg-muted/60 hover:text-foreground',
              'disabled:cursor-wait disabled:opacity-60',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              className,
            )}
          >
            <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
            <span>{isLoading ? 'Atualizando…' : 'Atualizar'}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{label}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Refresca apenas esta zona, sem recarregar o restante da página.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

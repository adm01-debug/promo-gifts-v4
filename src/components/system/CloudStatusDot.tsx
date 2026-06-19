/**
 * CloudStatusDot — Indicador discreto de saúde do Cloud (dev only).
 * Substitui o banner sticky quando o status é healthy/unknown.
 * Pequeno ponto flutuante no canto inferior direito com tooltip.
 */
import { memo } from 'react';
import { useCloudStatus } from '@/hooks/ui/useCloudStatus';
import { DevOnly } from '@/components/dev/DevOnly';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const CloudStatusDotInner = memo(() => {
  const { status } = useCloudStatus();

  // Mostra apenas em estados saudáveis — banner já cobre os demais.
  if (status !== 'healthy' && status !== 'unknown') return null;

  const color = status === 'healthy' ? 'bg-green-500' : 'bg-muted-foreground';
  const label =
    status === 'healthy'
      ? 'Cloud saudável — modo debug ativo'
      : 'Cloud status aguardando primeira sondagem';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="fixed bottom-3 right-3 z-40 inline-flex h-2.5 w-2.5 items-center justify-center"
            aria-label={label}
          >
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-40',
                color,
              )}
            />
            <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', color)} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export const CloudStatusDot = memo(() => {
  return (
    <DevOnly strict>
      <CloudStatusDotInner />
    </DevOnly>
  );
});

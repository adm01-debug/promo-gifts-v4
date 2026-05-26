/**
 * Botão global para pausar/retomar a instrumentação client-side
 * (bridge metrics + long task watchdog + estimativa de payload).
 *
 * Uso: permite ao operador isolar — sem F5 — se a lentidão percebida
 * durante a navegação vem da própria coleta de métricas. Quando pausado,
 * `recordBridgeCall` e `estimatePayloadBytes` viram no-op imediatos e o
 * PerformanceObserver de longtask é desconectado.
 *
 * Estado é compartilhado via store em `instrumentationControl` e
 * persistido em localStorage para sobreviver a reloads intencionais.
 */
import { useSyncExternalStore } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  isInstrumentationPaused,
  subscribeInstrumentationPaused,
  toggleInstrumentationPaused,
} from '@/lib/telemetry/instrumentationControl';

export function InstrumentationToggleButton() {
  const paused = useSyncExternalStore(
    subscribeInstrumentationPaused,
    isInstrumentationPaused,
    isInstrumentationPaused,
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={paused ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleInstrumentationPaused()}
            aria-pressed={paused}
            aria-label={paused ? 'Retomar instrumentação' : 'Pausar instrumentação'}
          >
            {paused ? (
              <>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Retomar instrumentação
              </>
            ) : (
              <>
                <Pause className="mr-1.5 h-3.5 w-3.5" />
                Pausar instrumentação
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {paused
            ? 'Coleta desligada: bridge calls e long tasks não serão registrados. Navegue e compare a fluidez.'
            : 'Pausa imediata (sem reload) da coleta client-side. Use para verificar se a instrumentação está afetando a navegação.'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

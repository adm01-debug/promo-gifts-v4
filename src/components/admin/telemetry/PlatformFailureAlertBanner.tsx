/**
 * PlatformFailureAlertBanner
 * --------------------------------------------------------------
 * Banner visual no topo do /admin/telemetria que reage a
 * `usePlatformFailureAlert`. Quando a taxa de 503 ou cold-start
 * ultrapassa o limite configurado, mostra um alerta destacado com
 * detalhes e popover para ajustar thresholds em runtime (localStorage).
 */
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, Settings2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePlatformFailureAlert,
  DEFAULT_ALERT_CONFIG,
  type FailureAlertConfig,
} from '@/pages/admin/telemetry/usePlatformFailureAlert';

interface Props {
  windowMinutes?: number;
}

export function PlatformFailureAlertBanner({ windowMinutes = 60 }: Props) {
  const { level, metrics, config, reason, setConfig } = usePlatformFailureAlert(windowMinutes);
  const [draft, setDraft] = useState<FailureAlertConfig>(config);

  const breached = level !== 'ok';

  return (
    <Alert
      className={cn(
        'transition-colors',
        breached
          ? 'border-destructive/60 bg-destructive/5 text-destructive [&>svg]:text-destructive'
          : 'border-emerald-500/30 bg-emerald-500/5 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400',
      )}
    >
      {breached ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <AlertTitle className="flex flex-wrap items-center gap-2">
            {breached
              ? 'Falhas do external-db-bridge acima do limite'
              : 'Saúde do external-db-bridge dentro do limite'}
            <Badge variant="outline" className="text-[10px]">
              janela {windowMinutes}min
            </Badge>
            {!config.enabled && (
              <Badge variant="outline" className="border-warning/40 text-[10px] text-warning">
                alerta desativado
              </Badge>
            )}
          </AlertTitle>
          <AlertDescription className="mt-1 space-y-0.5 text-xs">
            {metrics ? (
              <>
                <div>
                  503: <strong className="tabular-nums">{metrics.total503}</strong> (
                  {metrics.rate503Pct.toFixed(2)}%) · cold-start:{' '}
                  <strong className="tabular-nums">{metrics.totalColdStarts}</strong> (
                  {metrics.rateColdStartPct.toFixed(2)}%) · volume:{' '}
                  <strong className="tabular-nums">
                    {metrics.totalCalls.toLocaleString('pt-BR')}
                  </strong>
                </div>
                {breached && <div className="font-medium text-destructive">⚠ {reason}</div>}
                {!breached && metrics.totalCalls < config.minSamples && (
                  <div className="text-muted-foreground">
                    Volume abaixo de {config.minSamples} chamadas — alerta suspenso para evitar
                    falsos positivos.
                  </div>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Carregando métricas…</span>
            )}
          </AlertDescription>
        </div>

        <Popover onOpenChange={(open) => open && setDraft(config)}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Limites
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Limites de alerta</p>
              <p className="text-[11px] text-muted-foreground">
                Ajustes ficam salvos no navegador e valem para todos os admins desta sessão.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="alert-enabled" className="text-xs">
                Alerta ativado
              </Label>
              <Switch
                id="alert-enabled"
                checked={draft.enabled}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">Limite 503 (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={draft.threshold503Pct}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, threshold503Pct: Number(e.target.value) || 0 }))
                  }
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-[11px]">Limite cold-start (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={draft.thresholdColdStartPct}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, thresholdColdStartPct: Number(e.target.value) || 0 }))
                  }
                  className="h-8"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px]">Volume mínimo (amostras)</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={draft.minSamples}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, minSamples: Math.max(1, Number(e.target.value) || 1) }))
                }
                className="h-8"
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Evita disparo quando há poucas chamadas (ex.: 1/2 = 50%).
              </p>
            </div>

            <div className="flex justify-between gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(DEFAULT_ALERT_CONFIG);
                  setConfig(DEFAULT_ALERT_CONFIG);
                }}
              >
                Restaurar padrões
              </Button>
              <Button size="sm" onClick={() => setConfig(draft)}>
                Salvar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </Alert>
  );
}

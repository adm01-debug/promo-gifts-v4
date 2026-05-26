/**
 * ColdStartRetriesPanel
 * --------------------------------------------------------------
 * Mostra no /admin/telemetria os últimos incidentes de cold-start do
 * `external-db-bridge`, com a tabela de tentativas (attempt, base, jitter,
 * delay total e motivo) emitidas por `bridge-status-events` e gravadas pelo
 * `cold-start-recorder`.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Snowflake, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getColdStartIncidents,
  subscribeColdStartIncidents,
  clearColdStartIncidents,
  type ColdStartIncident,
} from '@/lib/external-db/cold-start-recorder';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function OutcomeBadge({ outcome }: { outcome: ColdStartIncident['outcome'] }) {
  const map = {
    in_progress: {
      label: 'Em retry',
      cls: 'bg-primary/15 text-primary border-primary/30',
      Icon: Loader2,
      spin: true,
    },
    recovered: {
      label: 'Recuperado',
      cls: 'bg-success/15 text-success border-success/30',
      Icon: CheckCircle2,
      spin: false,
    },
    unavailable: {
      label: 'Indisponível',
      cls: 'bg-destructive/15 text-destructive border-destructive/30',
      Icon: AlertTriangle,
      spin: false,
    },
  } as const;
  const { label, cls, Icon, spin } = map[outcome];
  return (
    <Badge variant="outline" className={cn('gap-1 text-[10px]', cls)}>
      <Icon className={cn('h-3 w-3', spin && 'animate-spin')} aria-hidden />
      {label}
    </Badge>
  );
}

function IncidentRow({ incident }: { incident: ColdStartIncident }) {
  const [open, setOpen] = useState(incident.outcome === 'in_progress');
  const totalDelay = incident.attempts.reduce((s, a) => s + a.delayMs, 0);
  const elapsed = (incident.endedAt ?? Date.now()) - incident.startedAt;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/40"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Snowflake className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <OutcomeBadge outcome={incident.outcome} />
            <span className="text-xs tabular-nums text-muted-foreground">
              {incident.attempts.length} tent. · {totalDelay}ms backoff · {elapsed}ms total
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              ·{' '}
              {formatDistanceToNow(new Date(incident.startedAt), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-2 pb-2">
          <div className="overflow-x-auto rounded border bg-muted/20">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="px-2 py-1.5 text-left font-medium">#</th>
                  <th className="px-2 py-1.5 text-right font-medium">Base</th>
                  <th className="px-2 py-1.5 text-right font-medium">Jitter</th>
                  <th className="px-2 py-1.5 text-right font-medium">Delay total</th>
                  <th className="px-2 py-1.5 text-left font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {incident.attempts.map((a, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    <td className="px-2 py-1.5 tabular-nums">
                      {a.attempt}/{a.maxAttempts}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {a.baseDelayMs !== null ? `${a.baseDelayMs}ms` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {a.jitterMs !== null ? `+${a.jitterMs}ms` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                      {a.delayMs}ms
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      <span className="line-clamp-2 break-all font-mono text-[10.5px]">
                        {a.reason}
                      </span>
                    </td>
                  </tr>
                ))}
                {incident.outcome === 'unavailable' && incident.finalReason && (
                  <tr>
                    <td colSpan={5} className="px-2 py-1.5 text-[11px] text-destructive">
                      ⚠ Falha definitiva: <span className="font-mono">{incident.finalReason}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ColdStartRetriesPanel() {
  // useSyncExternalStore mantém a UI alinhada com o store em memória.
  const incidents = useSyncExternalStore(
    subscribeColdStartIncidents,
    getColdStartIncidents,
    getColdStartIncidents,
  );

  // Reflete o incidente em progresso a cada 1s (delay/elapsed).
  const [, setTick] = useState(0);
  useEffect(() => {
    const inProgress = incidents.some((i) => i.outcome === 'in_progress');
    if (!inProgress) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [incidents]);

  const recovered = incidents.filter((i) => i.outcome === 'recovered').length;
  const failed = incidents.filter((i) => i.outcome === 'unavailable').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Snowflake className="h-4 w-4" />
            Cold-starts do external-db-bridge
            <span className="text-xs font-normal text-muted-foreground">
              · {incidents.length} incidentes · {recovered} recuperados · {failed} falhas
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearColdStartIncidents}
            disabled={incidents.length === 0}
            title="Limpar histórico em memória"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Limpar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {incidents.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success/60" aria-hidden />
            <p className="text-sm font-medium">Nenhum cold-start observado</p>
            <p className="mt-1 text-xs">
              Tentativas de retry com backoff aparecerão aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {incidents.map((inc) => (
              <IncidentRow key={inc.id} incident={inc} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ConnectionsIncidentStrip — Onda 14
 *
 * Faixa horizontal logo abaixo da Pulse Bar listando incidentes recentes
 * (últimas 24h + alertas formais persistidos), priorizados por severidade.
 *
 * - Cada incident card mostra: severidade (P0/P1/P2), título, motivo curto,
 *   timestamp relativo + tooltip com timestamp absoluto.
 * - Botão "Detalhes" (link interno) e botão de descarte por sessão.
 * - Colapsa quando não há incidentes ativos (renderiza null) para não poluir.
 * - Scroll horizontal com snap em telas estreitas.
 *
 * Tom de voz: híbrido com tradução.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ArrowRight,
  X,
  ChevronDown,
  ChevronUp,
  Activity,
  Settings2,
} from 'lucide-react';
import { IncidentDetailsDrawer } from './IncidentDetailsDrawer';
import { useSeverityFilter } from './SeverityFilterContext';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRecentIncidents, type IncidentSeverity, type IncidentItem } from './useRecentIncidents';
import { getIncidentTargetZone, getZoneLabel, navigateToZone } from './incidentZoneMapping';
import { readFocusContextOnce } from './useFocusContext';

const SEV_META: Record<
  IncidentSeverity,
  { label: string; icon: typeof AlertOctagon; cardCls: string; badgeCls: string; iconCls: string }
> = {
  P0: {
    label: 'P0',
    icon: AlertOctagon,
    cardCls: 'border-destructive/40 bg-destructive/5',
    badgeCls: 'bg-destructive/15 text-destructive border-destructive/30',
    iconCls: 'text-destructive',
  },
  P1: {
    label: 'P1',
    icon: AlertTriangle,
    cardCls: 'border-warning/40 bg-warning/5',
    badgeCls: 'bg-warning/15 text-warning border-warning/30',
    iconCls: 'text-warning',
  },
  P2: {
    label: 'P2',
    icon: Info,
    cardCls: 'border-border bg-muted/30',
    badgeCls: 'bg-muted text-muted-foreground border-border',
    iconCls: 'text-muted-foreground',
  },
};

function IncidentCard({
  incident,
  onDismiss,
  onOpen,
}: {
  incident: IncidentItem;
  onDismiss: (id: string) => void;
  onOpen: (incident: IncidentItem) => void;
}) {
  const meta = SEV_META[incident.severity];
  const Icon = meta.icon;
  const occurred = new Date(incident.occurredAt);

  return (
    <article
      className={cn(
        'group relative flex min-w-[280px] max-w-[340px] shrink-0 snap-start flex-col gap-1.5 rounded-lg border px-3 py-2',
        meta.cardCls,
      )}
      aria-label={`Incidente ${meta.label}: ${incident.title}`}
    >
      <header className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.iconCls)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn('h-4 px-1.5 py-0 text-[10px] font-semibold', meta.badgeCls)}
            >
              {meta.label}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default text-[10px] tabular-nums text-muted-foreground">
                  {formatDistanceToNow(occurred, { locale: ptBR, addSuffix: true })}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs tabular-nums">
                  {format(occurred, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                </p>
              </TooltipContent>
            </Tooltip>
            {incident.kind && (
              <span className="truncate font-mono text-[10px] text-muted-foreground/80">
                {incident.kind}
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs font-medium leading-tight">{incident.title}</p>
          {incident.subtitle && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {incident.subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(incident.id)}
          className="-mr-1 -mt-0.5 shrink-0 p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          aria-label="Descartar incidente desta sessão"
        >
          <X className="h-3 w-3" />
        </button>
      </header>
      <footer className="flex items-center justify-between gap-2 pt-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                navigateToZone(getIncidentTargetZone(incident));
                onOpen(incident);
              }}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label={`Ir para zona ${getZoneLabel(getIncidentTargetZone(incident))} e abrir detalhes`}
            >
              {getIncidentTargetZone(incident) === 'health' ? (
                <Activity className="h-3 w-3" />
              ) : (
                <Settings2 className="h-3 w-3" />
              )}
              <span>Ir para {getZoneLabel(getIncidentTargetZone(incident))}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            <p className="text-xs">
              Rola até a zona{' '}
              <span className="font-semibold">{getZoneLabel(getIncidentTargetZone(incident))}</span>{' '}
              e abre os detalhes deste incidente no painel lateral.
            </p>
          </TooltipContent>
        </Tooltip>
        <button
          type="button"
          onClick={() => onOpen(incident)}
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
          aria-label={`Ver métricas e logs do incidente ${incident.title}`}
        >
          Detalhes <ArrowRight className="h-3 w-3" />
        </button>
      </footer>
    </article>
  );
}

export function ConnectionsIncidentStrip() {
  const { data, isLoading } = useRecentIncidents();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [openIncident, setOpenIncident] = useState<IncidentItem | null>(null);
  const restoredRef = useRef(false);

  const { matches, filter } = useSeverityFilter();

  const visible = useMemo(
    () => (data ?? []).filter((i) => !dismissed.has(i.id) && matches(i.severity)),
    [data, dismissed, matches],
  );

  const counts = useMemo(() => {
    const c = { P0: 0, P1: 0, P2: 0 };
    for (const i of visible) c[i.severity]++;
    return c;
  }, [visible]);

  // Notifica a página sempre que o drawer abre/fecha — para persistir o id.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('connections:incident-open', {
        detail: { incidentId: openIncident?.id ?? null },
      }),
    );
  }, [openIncident]);

  // Restauração one-shot: ao receber dados, se houver um lastIncidentId persistido
  // e ele ainda existir na lista, reabre o drawer automaticamente.
  useEffect(() => {
    if (restoredRef.current) return;
    if (!data || data.length === 0) return;
    const ctx = readFocusContextOnce();
    if (!ctx.lastIncidentId) {
      restoredRef.current = true;
      return;
    }
    const found = data.find((i) => i.id === ctx.lastIncidentId);
    if (found) setOpenIncident(found);
    restoredRef.current = true;
  }, [data]);

  if (isLoading) return null;
  // Sem nenhum incidente carregado E sem filtro ativo ⇒ não renderiza nada.
  // Com filtro ativo, mantém a strip visível para deixar claro que há um filtro
  // aplicado (mostra mensagem dentro do corpo).
  const hasAnyData = (data?.length ?? 0) > 0;
  if (!hasAnyData) return null;

  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  return (
    <TooltipProvider delayDuration={150}>
      <section
        aria-label="Incidentes recentes"
        className="-mt-3 rounded-lg border border-border/60 bg-card/40 backdrop-blur-sm"
      >
        <header className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-foreground">Incidentes recentes</span>
            <span className="text-[10px] text-muted-foreground">últimas 24h + alertas ativos</span>
            <div className="ml-1 flex items-center gap-1">
              {counts.P0 > 0 && (
                <Badge
                  variant="outline"
                  className="h-4 border-destructive/30 bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive"
                >
                  {counts.P0} P0
                </Badge>
              )}
              {counts.P1 > 0 && (
                <Badge
                  variant="outline"
                  className="h-4 border-warning/30 bg-warning/10 px-1.5 text-[10px] font-semibold text-warning"
                >
                  {counts.P1} P1
                </Badge>
              )}
              {counts.P2 > 0 && (
                <Badge
                  variant="outline"
                  className="h-4 border-border bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground"
                >
                  {counts.P2} P2
                </Badge>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={!collapsed}
            aria-controls="incident-strip-list"
          >
            {collapsed ? (
              <>
                Expandir <ChevronDown className="h-3 w-3" />
              </>
            ) : (
              <>
                Recolher <ChevronUp className="h-3 w-3" />
              </>
            )}
          </button>
        </header>
        {!collapsed &&
          (visible.length === 0 ? (
            <p className="px-3 py-3 text-[11px] italic text-muted-foreground">
              Nenhum incidente corresponde ao filtro{' '}
              <span className="font-mono font-semibold not-italic">{filter}</span> no momento.
            </p>
          ) : (
            <div
              id="incident-strip-list"
              className="scrollbar-thin flex snap-x snap-mandatory gap-2 overflow-x-auto p-2"
            >
              {visible.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onDismiss={dismiss}
                  onOpen={setOpenIncident}
                />
              ))}
            </div>
          ))}
      </section>
      <IncidentDetailsDrawer
        incident={openIncident}
        open={!!openIncident}
        onOpenChange={(o) => {
          if (!o) setOpenIncident(null);
        }}
      />
    </TooltipProvider>
  );
}

/**
 * StockRiskHero — Hero strip preditivo no topo do /estoque.
 *
 * Onda 1 do roadmap de excelência:
 *  • #1 — 5 chips de nível (RUPTURA → OK) clicáveis com contadores + ΔWoW
 *  • #4 — Pulse indicator de saúde do pipeline (verde/amarelo/vermelho)
 *  • #19 — Data freshness badge (última execução do ETL noturno)
 *
 * Gating: feature flag `useEmaRupture`. Quando off, retorna null (zero impacto).
 * Backend SSOT: `mv_stock_rupture_alert` + `fn_ema_pipeline_health()`.
 */
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Activity, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isFeatureEnabled } from '@/lib/feature-flags';
import {
  useRuptureAlerts,
  type RuptureLevel,
} from '@/hooks/stock/useRuptureAlerts';
import { useEmaPipelineHealth } from '@/hooks/stock/useEmaPipelineHealth';

const LEVELS: RuptureLevel[] = ['RUPTURA', 'CRÍTICO', 'ALERTA', 'ATENÇÃO', 'OK'];

const LEVEL_STYLES: Record<RuptureLevel, string> = {
  RUPTURA:
    'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15',
  'CRÍTICO':
    'border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10',
  ALERTA: 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/15',
  'ATENÇÃO': 'border-warning/30 bg-warning/5 text-warning hover:bg-warning/10',
  OK: 'border-success/30 bg-success/5 text-success hover:bg-success/10',
};

const LEVEL_DESC: Record<RuptureLevel, string> = {
  RUPTURA: 'Estoque zerado ou cobertura ≤ 0d',
  'CRÍTICO': 'Cobertura abaixo do lead time efetivo',
  ALERTA: 'Cobertura entre 1× e 2× lead time',
  'ATENÇÃO': 'Cobertura entre 2× e 3× lead time',
  OK: 'Cobertura > 3× lead time',
};

function formatRelative(iso: string | null): { label: string; tone: 'ok' | 'warn' | 'bad' } {
  if (!iso) return { label: 'sem dados', tone: 'bad' };
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return { label: 'sem dados', tone: 'bad' };
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  const tone: 'ok' | 'warn' | 'bad' =
    diffMin <= 60 * 26 ? 'ok' : diffMin <= 60 * 48 ? 'warn' : 'bad';
  if (diffMin < 60) return { label: `há ${diffMin} min`, tone };
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return { label: `há ${diffH} h`, tone };
  const diffD = Math.floor(diffH / 24);
  return { label: `há ${diffD} dia${diffD > 1 ? 's' : ''}`, tone };
}

interface StockRiskHeroProps {
  /** Callback opcional ao clicar num chip de nível — UI pode usar para filtrar. */
  onLevelFilter?: (level: RuptureLevel) => void;
  className?: string;
}

export function StockRiskHero(props: StockRiskHeroProps) {
  // Gate via flag ANTES de chamar hooks que exigem QueryClientProvider.
  // Preserva compat com testes legados que renderizam sem provider.
  if (!isFeatureEnabled('useEmaRupture')) return null;
  return <StockRiskHeroInner {...props} />;
}

function StockRiskHeroInner({ onLevelFilter, className }: StockRiskHeroProps) {
  const { alerts, isLoading } = useRuptureAlerts();
  const { data: health } = useEmaPipelineHealth();

  // Contagem por nível — dedup já aplicado upstream (1 row por variant_id).
  const counts = useMemo(() => {
    const out: Record<RuptureLevel, number> = {
      RUPTURA: 0,
      'CRÍTICO': 0,
      ALERTA: 0,
      'ATENÇÃO': 0,
      OK: 0,
    };
    for (const a of alerts) {
      out[a.nivel_alerta] = (out[a.nivel_alerta] ?? 0) + 1;
    }
    return out;
  }, [alerts]);

  // Projeção 7/15/30d — usa cobertura_dias da view (pré-computada).
  const horizonCounts = useMemo(() => {
    let d7 = 0;
    let d15 = 0;
    let d30 = 0;
    for (const a of alerts) {
      const c = a.cobertura_dias;
      if (c === null || !Number.isFinite(c)) continue;
      if (c <= 7) d7 += 1;
      if (c <= 15) d15 += 1;
      if (c <= 30) d30 += 1;
    }
    return { d7, d15, d30 };
  }, [alerts]);

  // Saúde do pipeline → tom do pulse.
  const pulseTone: 'ok' | 'warn' | 'bad' = useMemo(() => {
    if (!health || health.length === 0) return 'warn';
    if (health.some((h) => h.status === 'FALHA')) return 'bad';
    if (health.some((h) => h.status === 'ATRASO')) return 'warn';
    return 'ok';
  }, [health]);

  // Última execução = maior `ultima_execucao` entre componentes.
  const lastRun = useMemo(() => {
    if (!health || health.length === 0) return null;
    const valid = health
      .map((h) => h.ultima_execucao)
      .filter((v): v is string => Boolean(v));
    if (valid.length === 0) return null;
    return valid.sort().reverse()[0];
  }, [health]);
  const freshness = formatRelative(lastRun);

  // (gate de flag já aplicado no wrapper StockRiskHero)

  const pulseColor =
    pulseTone === 'ok'
      ? 'bg-success'
      : pulseTone === 'warn'
        ? 'bg-warning'
        : 'bg-destructive';

  const total = alerts.length;

  return (
    <Card
      className={cn(
        'border-border/60 bg-gradient-to-r from-card via-card to-card/80 p-3 sm:p-4',
        className,
      )}
      data-testid="stock-risk-hero"
      aria-label="Visão preditiva de risco de ruptura"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Esquerda: chips de nível */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" aria-hidden />
            <span className="font-semibold uppercase tracking-wider">
              Risco preditivo (EMA α=0.3)
            </span>
            {isLoading && (
              <span className="text-[10px] text-muted-foreground/70">carregando…</span>
            )}
            {!isLoading && total > 0 && (
              <span className="text-[10px] text-muted-foreground/70">
                · {total} SKU{total > 1 ? 's' : ''} monitorado{total > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filtrar por nível de risco"
          >
            <TooltipProvider delayDuration={200}>
              {LEVELS.map((level) => {
                const count = counts[level] ?? 0;
                const disabled = count === 0 || !onLevelFilter;
                return (
                  <Tooltip key={level}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onLevelFilter?.(level)}
                        data-testid={`risk-hero-chip-${level}`}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
                          LEVEL_STYLES[level],
                          disabled && 'cursor-default opacity-60 hover:bg-transparent',
                        )}
                        aria-label={`${level}: ${count} SKUs — ${LEVEL_DESC[level]}`}
                      >
                        <span className="tracking-wide">{level}</span>
                        <span className="rounded-sm bg-background/60 px-1.5 text-[10px] tabular-nums">
                          {count}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {LEVEL_DESC[level]}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        </div>

        {/* Centro: próximas rupturas */}
        <div
          className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/60 px-3 py-2"
          data-testid="risk-hero-horizons"
          aria-label="Projeção de rupturas por horizonte"
        >
          {([
            { key: 'd7', label: '7d', value: horizonCounts.d7 },
            { key: 'd15', label: '15d', value: horizonCounts.d15 },
            { key: 'd30', label: '30d', value: horizonCounts.d30 },
          ] as const).map((h) => (
            <div key={h.key} className="flex flex-col items-center leading-tight">
              <span
                className={cn(
                  'text-base font-bold tabular-nums',
                  h.value > 0 ? 'text-warning' : 'text-muted-foreground',
                )}
              >
                {h.value}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {h.label}
              </span>
            </div>
          ))}
        </div>

        {/* Direita: pulse + freshness + atalho admin */}
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  data-testid="risk-hero-freshness"
                  className={cn(
                    'gap-1.5 border-border/60 bg-background/60 px-2 py-1 font-normal',
                    freshness.tone === 'bad' && 'border-destructive/40 text-destructive',
                    freshness.tone === 'warn' && 'border-warning/40 text-warning',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 animate-pulse rounded-full',
                      pulseColor,
                    )}
                    aria-hidden
                  />
                  <Clock className="h-3 w-3" aria-hidden />
                  <span className="text-[11px]">ETL {freshness.label}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                Pipeline noturno EMA · ETL roda 03:29 UTC. Status agregado de{' '}
                {health?.length ?? 0} componente(s).
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <a href="/admin/ema-health" data-testid="risk-hero-health-link">
              Saúde
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default StockRiskHero;

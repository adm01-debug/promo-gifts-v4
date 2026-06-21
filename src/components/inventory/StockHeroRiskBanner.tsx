/**
 * StockHeroRiskBanner — Faixa de risco EMA no topo do /estoque.
 * Chips clicáveis por nivel_alerta (RUPTURA → OK + SEM_SINAL) +
 * pulse de frescor do ETL. Sem feature flag — sempre visível.
 * Inserido ACIMA do StockDashboard (aditivo, sem mover nada).
 */
import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, Clock } from 'lucide-react';
import { useEmaRiskSummary, type EmaRiskSummaryRow } from '@/hooks/stock/useEmaRiskSummary';
import { Skeleton } from '@/components/ui/skeleton';

const LEVEL_ORDER = ['RUPTURA', 'CRÍTICO', 'ALERTA', 'ATENÇÃO', 'SEM_SINAL', 'OK'] as const;
type LevelKey = (typeof LEVEL_ORDER)[number];

const CHIP_CFG: Record<LevelKey, { border: string; bg: string; active: string; text: string; dot: string }> = {
  RUPTURA:     { border: 'border-red-500/40',     bg: 'bg-red-500/10 hover:bg-red-500/20',       active: 'bg-red-500/20 ring-1 ring-red-500/50',       text: 'text-red-600 dark:text-red-400',       dot: 'bg-red-500' },
  'CRÍTICO':   { border: 'border-orange-500/40',  bg: 'bg-orange-500/10 hover:bg-orange-500/20',  active: 'bg-orange-500/20 ring-1 ring-orange-500/50', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  ALERTA:      { border: 'border-amber-500/40',   bg: 'bg-amber-500/10 hover:bg-amber-500/20',    active: 'bg-amber-500/20 ring-1 ring-amber-500/50',   text: 'text-amber-600 dark:text-amber-400',  dot: 'bg-amber-500' },
  'ATENÇÃO':   { border: 'border-yellow-500/40',  bg: 'bg-yellow-500/10 hover:bg-yellow-500/20',  active: 'bg-yellow-500/20 ring-1 ring-yellow-500/50', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  SEM_SINAL:   { border: 'border-border/40',      bg: 'bg-muted/30 hover:bg-muted/60',            active: 'bg-muted ring-1 ring-border',                text: 'text-muted-foreground',               dot: 'bg-muted-foreground' },
  OK:          { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',active: 'bg-emerald-500/20 ring-1 ring-emerald-500/50',text: 'text-emerald-600 dark:text-emerald-400',dot: 'bg-emerald-500' },
};

const LABEL: Record<LevelKey, string> = {
  RUPTURA:   'RUPTURA',
  'CRÍTICO': 'CRÍTICO',
  ALERTA:    'ALERTA',
  'ATENÇÃO': 'ATENÇÃO',
  SEM_SINAL: 'S/ SINAL',
  OK:        'OK',
};

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const diffMin = Math.round((Date.now() - d.getTime()) / 60_000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `há ${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
  } catch {
    return '—';
  }
}

interface Props {
  /** Chip atualmente selecionado — controlado pelo pai. */
  activeLevel?: string | null;
  /** Acionado ao clicar num chip. null = deselecionar. */
  onLevelClick?: (level: string | null) => void;
}

export function StockHeroRiskBanner({ activeLevel, onLevelClick }: Props) {
  const { rows, totalVariants, etlHealth, isLoading, error } = useEmaRiskSummary();

  const byLevel = new Map<string, EmaRiskSummaryRow>(rows.map((r) => [r.nivel_alerta, r]));

  const criticalTotal =
    (byLevel.get('RUPTURA')?.total ?? 0) + (byLevel.get('CRÍTICO')?.total ?? 0);
  const criticalPct =
    totalVariants > 0 ? Math.round((criticalTotal / totalVariants) * 100) : 0;

  return (
    <div
      className="rounded-xl border border-border/40 bg-card p-4 shadow-sm"
      role="region"
      aria-label="Resumo de risco EMA por nível"
    >
      {/* Header: título + % crítico + pulse ETL */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Risco por Nível (EMA)</span>
          {!isLoading && totalVariants > 0 && (
            <span className="text-xs text-muted-foreground">
              · {totalVariants.toLocaleString('pt-BR')} variações
            </span>
          )}
          {!isLoading && criticalPct > 0 && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                criticalPct >= 30
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              )}
            >
              {criticalPct}% crítico+ruptura
            </span>
          )}
        </div>

        {/* Pulse ETL */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>EMA {formatRelative(etlHealth.freshness)}</span>
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              etlHealth.status === 'OK'
                ? 'bg-emerald-500'
                : etlHealth.status === 'WARN'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-red-500 animate-pulse',
            )}
            aria-label={`ETL status: ${etlHealth.status}`}
          />
        </div>
      </div>

      {/* Chips */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {LEVEL_ORDER.map((l) => (
            <Skeleton key={l} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Não foi possível carregar o sumário EMA.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {LEVEL_ORDER.map((lvl) => {
            const row = byLevel.get(lvl);
            const count = row?.total ?? 0;
            const cfg = CHIP_CFG[lvl];
            const isActive = activeLevel === lvl;

            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onLevelClick?.(isActive ? null : lvl)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all',
                  cfg.border,
                  isActive ? cfg.active : cfg.bg,
                  count === 0 && 'cursor-not-allowed opacity-40',
                )}
                aria-pressed={isActive}
                aria-label={`${LABEL[lvl]}: ${count} variações`}
                disabled={count === 0}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className={cn('text-xs font-bold uppercase tracking-wide', cfg.text)}>
                    {LABEL[lvl]}
                  </span>
                  <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', cfg.dot)} />
                </div>
                <div className={cn('text-xl font-bold tabular-nums', cfg.text)}>
                  {count.toLocaleString('pt-BR')}
                </div>
                <div className="text-xs text-muted-foreground">variações</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

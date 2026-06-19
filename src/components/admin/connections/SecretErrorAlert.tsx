import { AlertCircle, Info, RefreshCw, Activity, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { NormalizedSecretError } from './secretErrors';

interface Props {
  error: NormalizedSecretError;
  onRetry?: () => void;
  retryLabel?: string;
  retryDisabled?: boolean;
  className?: string;
  /** Compact = inline near a field; expanded = standalone block. */
  variant?: 'compact' | 'expanded';
  /** When provided, renders a "Ver detalhes" link that opens a details modal. */
  onViewDetails?: () => void;
  detailsLabel?: string;
  /** HTTP status do último teste — exibido como chip destacado quando presente. */
  httpStatus?: number | null;
  /** Latência total em ms — exibida como chip destacado quando presente. */
  latencyMs?: number | null;
}

/** Cor do chip de status conforme faixa HTTP. */
function statusTone(status: number): string {
  if (status >= 500) return 'border-destructive/50 bg-destructive/10 text-destructive';
  if (status >= 400) return 'border-warning/50 bg-warning/10 text-warning';
  if (status >= 300) return 'border-muted-foreground/40 bg-muted text-foreground';
  return 'border-success/40 bg-success/10 text-success';
}

/** Cor do chip de latência: <500ms ok, <2s atenção, ≥2s lento. */
function latencyTone(ms: number): string {
  if (ms >= 2000) return 'border-destructive/50 bg-destructive/10 text-destructive';
  if (ms >= 500) return 'border-warning/50 bg-warning/10 text-warning';
  return 'border-success/40 bg-success/10 text-success';
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
}

/**
 * Single source of truth for rendering credential/connection errors.
 * Same chip + headline + description + hint + retry button everywhere.
 */
export function SecretErrorAlert({
  error,
  onRetry,
  retryLabel = 'Tentar novamente',
  retryDisabled,
  className,
  variant = 'compact',
  onViewDetails,
  detailsLabel = 'Ver detalhes',
  httpStatus,
  latencyMs,
}: Props) {
  const showRetry = !!onRetry && error.retryable;
  const showDetails = !!onViewDetails;
  const hasStatus = typeof httpStatus === 'number' && Number.isFinite(httpStatus);
  const hasLatency = typeof latencyMs === 'number' && Number.isFinite(latencyMs) && latencyMs >= 0;
  const showMetaRow = hasStatus || hasLatency;
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border border-destructive/30 bg-destructive/5 duration-200 animate-in fade-in',
        variant === 'expanded' ? 'space-y-2 p-3' : 'px-2.5 py-2 text-xs',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5 text-destructive">
          <AlertCircle
            className={cn(
              'shrink-0',
              variant === 'expanded' ? 'mt-0.5 h-4 w-4' : 'mt-0.5 h-3.5 w-3.5',
            )}
          />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="border-destructive/40 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-destructive"
              >
                {error.categoryLabel}
              </Badge>
              {variant === 'expanded' && (
                <span className="text-sm font-semibold text-foreground">{error.title}</span>
              )}
            </div>
            {showMetaRow && (
              <div
                className="flex flex-wrap items-center gap-1.5"
                aria-label="Métricas do último teste"
              >
                {hasStatus && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-1.5 py-0 font-mono text-[10px] font-semibold',
                      statusTone(httpStatus),
                    )}
                    title={`HTTP ${httpStatus}`}
                  >
                    <Activity className="h-3 w-3" />
                    HTTP {httpStatus}
                  </span>
                )}
                {hasLatency && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-1.5 py-0 font-mono text-[10px] font-semibold',
                      latencyTone(latencyMs),
                    )}
                    title={`Latência total: ${latencyMs} ms`}
                  >
                    <Timer className="h-3 w-3" />
                    {formatLatency(latencyMs)}
                  </span>
                )}
              </div>
            )}
            <p className="break-words font-medium leading-snug text-destructive">
              {error.description}
            </p>
            {error.hint && (
              <p className="break-words leading-snug text-muted-foreground">{error.hint}</p>
            )}
          </div>
        </div>
        {(showRetry || showDetails) && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {showRetry && (
              <Button
                size="sm"
                variant="outline"
                className={cn(variant === 'expanded' ? 'h-8' : 'h-7 px-2')}
                onClick={onRetry}
                disabled={retryDisabled}
              >
                <RefreshCw
                  className={cn('mr-1', variant === 'expanded' ? 'h-3.5 w-3.5' : 'h-3 w-3')}
                />
                {retryLabel}
              </Button>
            )}
            {showDetails && (
              <Button
                type="button"
                size="sm"
                variant="link-secondary"
                className={cn('px-1', variant === 'expanded' ? 'h-8' : 'h-7')}
                onClick={onViewDetails}
                aria-label={`${detailsLabel} do erro`}
              >
                <Info className={cn('mr-1', variant === 'expanded' ? 'h-3.5 w-3.5' : 'h-3 w-3')} />
                {detailsLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

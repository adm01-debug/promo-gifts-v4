/**
 * Volume Indicator
 * Indicador visual de volume utilizado na caixa
 */

import { Box, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatVolume, getVolumeStatusColor, getVolumeStatusLabel } from '@/lib/kit-builder';

interface VolumeIndicatorProps {
  usedVolume: number;
  totalVolume: number;
  usagePercent: number;
  className?: string;
  variant?: 'compact' | 'default';
}

const VOLUME_STATUS_TEXT_COLORS = {
  success: 'text-primary',
  warning: 'text-warning',
  destructive: 'text-destructive',
} as const;

const VOLUME_PROGRESS_BG_COLORS = {
  success: 'bg-primary',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
} as const;

export function VolumeIndicator({
  usedVolume,
  totalVolume,
  usagePercent,
  className,
  variant = 'default',
}: VolumeIndicatorProps) {
  const status = getVolumeStatusColor(usagePercent);
  const label = getVolumeStatusLabel(usagePercent);

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Box className={cn('h-4 w-4', VOLUME_STATUS_TEXT_COLORS[status])} />
        <div className="relative h-2 w-20 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn('h-full transition-all', VOLUME_PROGRESS_BG_COLORS[status])}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <span className={cn('text-xs font-medium', VOLUME_STATUS_TEXT_COLORS[status])}>
          {Math.round(usagePercent)}%
        </span>
      </div>
    );
  }

  return (
    <div className={cn('card-elevated space-y-3 p-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className={cn('h-5 w-5', VOLUME_STATUS_TEXT_COLORS[status])} />
          <span className="font-medium">Volume do Kit</span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'destructive' ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : status === 'success' ? (
            <CheckCircle className="h-4 w-4 text-primary" />
          ) : null}
          <span className={cn('text-sm font-medium', VOLUME_STATUS_TEXT_COLORS[status])}>
            {label}
          </span>
        </div>
      </div>

      {/* Custom progress bar with dynamic color */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full transition-all', VOLUME_PROGRESS_BG_COLORS[status])}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Usado: <strong className="text-foreground">{formatVolume(usedVolume)}</strong>
        </span>
        <span>
          Disponível:{' '}
          <strong className="text-foreground">{formatVolume(totalVolume - usedVolume)}</strong>
        </span>
        <span>
          <strong className={VOLUME_STATUS_TEXT_COLORS[status]}>{Math.round(usagePercent)}%</strong>
        </span>
      </div>

      {usagePercent > 100 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Volume excede a capacidade da caixa. Remova alguns itens.</span>
        </div>
      )}
    </div>
  );
}

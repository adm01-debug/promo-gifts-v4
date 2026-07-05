/**
 * EngravingBadge — Badge padronizado de personalização/gravação em 2 linhas.
 *
 * Linha 1: [marker] [location?] título da técnica
 * Linha 2: meta ("Área · Cores · Qtd" ou equivalente)
 *
 * Variantes:
 * - `boxed` (default): borda + fundo primary/10 (usado em tabelas/listas soltas)
 * - `plain`: sem borda/fundo (para uso aninhado dentro de outro card)
 */
import React from 'react';
import { cn } from '@/lib/utils';

export type EngravingBadgeVariant = 'boxed' | 'plain';

export interface EngravingBadgeProps {
  /** Título principal da gravação (ex: "Fiber Laser | Plana"). */
  title: string;
  /** Metadados secundários (ex: "Lado A · 3×5 cm · 1 cor"). */
  meta?: string | null;
  /** Rótulo curto exibido como "pílula" antes do título (ex: "Lado A"). */
  location?: string | null;
  /** Marcador visual antes do título (default: ✦, apenas em `boxed`). */
  marker?: string;
  variant?: EngravingBadgeVariant;
  className?: string;
  'data-testid'?: string;
}

export function EngravingBadge({
  title,
  meta,
  location,
  marker = '✦',
  variant = 'boxed',
  className,
  'data-testid': testId = 'engraving-badge',
}: EngravingBadgeProps) {
  const showMarker = variant === 'boxed';
  const tooltip = [location, title, meta].filter(Boolean).join(' — ');

  return (
    <span
      data-testid={testId}
      data-variant={variant}
      className={cn(
        'flex flex-col gap-0.5 leading-tight',
        variant === 'boxed' &&
          'rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-[11px]',
        variant === 'plain' && 'text-[11px]',
        className,
      )}
      title={tooltip}
    >
      <span
        data-testid={`${testId}-title`}
        className="font-semibold text-primary"
      >
        {showMarker && <>{marker} </>}
        {location && (
          <span className="mr-1 rounded bg-primary/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-primary">
            {location}
          </span>
        )}
        {title}
      </span>
      {meta && (
        <span
          data-testid={`${testId}-meta`}
          className="text-[10px] text-muted-foreground"
        >
          {meta}
        </span>
      )}
    </span>
  );
}

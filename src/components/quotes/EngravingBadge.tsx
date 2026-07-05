/**
 * EngravingBadge — Badge padronizado de personalização/gravação em 2 linhas.
 *
 * Linha 1: ✦ título da técnica (destacado em primary)
 * Linha 2: meta ("Lado · Área · Cores" ou equivalente)
 *
 * Usado no QuoteItemsTable e demais superfícies que listam gravações,
 * espelhando o padrão visual do Resumo do QuoteBuilder.
 */
import React from 'react';
import { cn } from '@/lib/utils';

export interface EngravingBadgeProps {
  /** Título principal da gravação (ex: "Fiber Laser | Plana"). */
  title: string;
  /** Metadados secundários (ex: "Lado A · 3×5 cm · 1 cor"). */
  meta?: string | null;
  /** Marcador visual antes do título (default: ✦). */
  marker?: string;
  className?: string;
  'data-testid'?: string;
}

export function EngravingBadge({
  title,
  meta,
  marker = '✦',
  className,
  'data-testid': testId = 'engraving-badge',
}: EngravingBadgeProps) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'flex flex-col gap-0.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] leading-tight',
        className,
      )}
      title={meta ? `${title} — ${meta}` : title}
    >
      <span
        data-testid={`${testId}-title`}
        className="font-semibold text-primary"
      >
        {marker} {title}
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

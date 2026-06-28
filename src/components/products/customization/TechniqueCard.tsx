/**
 * TechniqueCard — Card de técnica de gravação
 *
 * Mostra nome, grupo, dimensões efetivas, setup e info de cores.
 * Baseado no briefing v6 (12/02/2026).
 */

import { Check, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TechniqueOption } from '@/types/customization';

interface TechniqueCardProps {
  technique: TechniqueOption;
  isSelected: boolean;
  onSelect: (technique: TechniqueOption) => void;
}

const GROUP_ACCENT: Record<string, string> = {
  LASER: 'before:bg-info',
  SERIGRAFIA: 'before:bg-success',
  UV_DIGITAL: 'before:bg-primary',
  SUBLIMACAO: 'before:bg-brand-primary',
  BORDADO: 'before:bg-destructive',
  TAMPOGRAFIA: 'before:bg-success',
  TRANSFER: 'before:bg-warning',
  HOT_STAMPING: 'before:bg-warning',
};

function getGroupAccent(grupo: string): string {
  return GROUP_ACCENT[grupo] || 'before:bg-border';
}

export function TechniqueCard({ technique, isSelected, onSelect }: TechniqueCardProps) {
  const isDigitalTechnique = ['UV_DIGITAL', 'SUBLIMACAO', 'TRANSFER'].includes(
    technique.grupo_tecnica,
  );
  const colorLabel = technique.cobra_por_cor
    ? `até ${technique.max_cores} cor${technique.max_cores !== 1 ? 'es' : ''}`
    : isDigitalTechnique
      ? 'Full Color'
      : `1 cor`;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={`${technique.tecnica_nome} — ${technique.grupo_tecnica}, ${colorLabel}, até ${technique.efetiva_largura_max} por ${technique.efetiva_altura_max} centímetros${isSelected ? ' (selecionada)' : ''}`}
      className={cn(
        'relative flex w-full items-center gap-3 overflow-hidden rounded-lg border px-3 py-2 text-left transition-all duration-150',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px]',
        getGroupAccent(technique.grupo_tecnica),
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isSelected
          ? 'border-primary/60 bg-primary/[0.06]'
          : 'border-border/60 bg-card hover:border-border hover:bg-secondary/40',
      )}
      data-technique-id={technique.technique_id}
      data-testid={`customization-technique-card-${technique.technique_id}`}
      onClick={() => onSelect(technique)}
    >
      <div
        className={cn(
          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40',
        )}
        aria-hidden
      >
        {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground">
            {technique.tecnica_nome}
          </span>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
            · {technique.grupo_tecnica.replace('_', ' ')}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          <Maximize2 className="h-2.5 w-2.5" aria-hidden />
          <span>até {technique.efetiva_largura_max}×{technique.efetiva_altura_max}cm</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{colorLabel}</span>
          {technique.is_curved && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>curvo</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}


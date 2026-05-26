/**
 * TechniqueCard — Card de técnica de gravação
 *
 * Mostra nome, grupo, dimensões efetivas, setup e info de cores.
 * Baseado no briefing v6 (12/02/2026).
 */

import { Check, Maximize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TechniqueOption } from '@/types/customization';

interface TechniqueCardProps {
  technique: TechniqueOption;
  isSelected: boolean;
  onSelect: (technique: TechniqueOption) => void;
}

const GROUP_COLORS: Record<string, string> = {
  LASER: 'bg-info/10 text-info border-info/20',
  SERIGRAFIA: 'bg-success/10 text-success border-success/20',
  UV_DIGITAL: 'bg-primary/10 text-primary border-primary/20',
  SUBLIMACAO: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
  BORDADO: 'bg-destructive/10 text-destructive border-destructive/20',
  TAMPOGRAFIA: 'bg-success/10 text-success border-success/20',
  TRANSFER: 'bg-warning/10 text-warning border-warning/20',
  HOT_STAMPING: 'bg-warning/10 text-warning border-warning/20',
};

function getGroupColor(grupo: string): string {
  return GROUP_COLORS[grupo] || 'bg-muted text-muted-foreground border-border';
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
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isSelected
          ? 'border-primary/60 bg-primary/10 shadow-sm ring-2 ring-primary/30'
          : 'border-border/50 bg-secondary/50 hover:border-border hover:bg-secondary/80',
      )}
      data-technique-id={technique.technique_id}
      data-testid={`customization-technique-card-${technique.technique_id}`}
      onClick={() => onSelect(technique)}
    >
      {/* Radio */}
      <div
        className={cn(
          'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40',
        )}
      >
        {isSelected && <Check className="h-3 w-3" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{technique.tecnica_nome}</span>
          <Badge
            variant="outline"
            className={cn('h-5 border text-[10px]', getGroupColor(technique.grupo_tecnica))}
          >
            {technique.grupo_tecnica}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Maximize2 className="h-3 w-3" />
            até {technique.efetiva_largura_max} × {technique.efetiva_altura_max} cm
          </span>
          <span>{colorLabel}</span>
          {technique.is_curved && (
            <Badge variant="outline" className="h-4 text-[10px]">
              curvo
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

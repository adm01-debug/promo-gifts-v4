/**
 * TechniqueOption — Etapa 2: Opção de grupo de técnica
 *
 * Mostra APENAS o nome do grupo (Laser, UV Digital, Serigrafia).
 * Sem preço, sem variação, sem dimensão.
 */

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TechniqueOptionProps {
  groupCode: string;
  groupLabel: string;
  isSelected: boolean;
  onSelect: (groupCode: string) => void;
}

export function TechniqueOption({
  groupCode,
  groupLabel,
  isSelected,
  onSelect,
}: TechniqueOptionProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border p-3 text-left transition-all duration-200',
        isSelected
          ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20'
          : 'border-border/50 bg-secondary/50 hover:border-border hover:bg-secondary/80',
      )}
      onClick={() => onSelect(groupCode)}
    >
      <div
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40',
        )}
      >
        {isSelected && <Check className="h-3 w-3" />}
      </div>
      <span className="text-sm font-medium text-foreground">{groupLabel}</span>
    </button>
  );
}

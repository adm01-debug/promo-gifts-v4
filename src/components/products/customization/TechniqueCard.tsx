/**
 * TechniqueCard — Card de técnica de gravação
 * 
 * Mostra nome, grupo, dimensões efetivas, setup e info de cores.
 * Baseado no briefing v6 (12/02/2026).
 */

import { Check, Maximize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TechniqueOption } from "@/types/customization";

interface TechniqueCardProps {
  technique: TechniqueOption;
  isSelected: boolean;
  onSelect: (technique: TechniqueOption) => void;
}

const GROUP_COLORS: Record<string, string> = {
  LASER: "bg-info/10 text-info border-info/20",
  SERIGRAFIA: "bg-success/10 text-success border-success/20",
  UV_DIGITAL: "bg-primary/10 text-primary border-primary/20",
  SUBLIMACAO: "bg-orange/10 text-orange border-orange/20",
  BORDADO: "bg-destructive/10 text-destructive border-destructive/20",
  TAMPOGRAFIA: "bg-success/10 text-success border-success/20",
  TRANSFER: "bg-warning/10 text-warning border-warning/20",
  HOT_STAMPING: "bg-warning/10 text-warning border-warning/20",
};

function getGroupColor(grupo: string): string {
  return GROUP_COLORS[grupo] || "bg-muted text-muted-foreground border-border";
}

export function TechniqueCard({ technique, isSelected, onSelect }: TechniqueCardProps) {
  const isDigitalTechnique = ['UV_DIGITAL', 'SUBLIMACAO', 'TRANSFER'].includes(technique.grupo_tecnica);
  const colorLabel = technique.cobra_por_cor
    ? `até ${technique.max_cores} cor${technique.max_cores !== 1 ? 'es' : ''}`
    : isDigitalTechnique
      ? 'Full Color'
      : `1 cor`;

  return (
    <button
      className={cn(
        "w-full p-3 rounded-lg flex items-start gap-3 transition-all duration-200 border text-left",
        isSelected
          ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
          : "bg-secondary/50 border-border/50 hover:bg-secondary/80 hover:border-border"
      )}
      onClick={() => onSelect(technique)}
    >
      {/* Radio */}
      <div className={cn(
        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5 flex-shrink-0",
        isSelected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40"
      )}>
        {isSelected && <Check className="h-3 w-3" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground">
            {technique.tecnica_nome}
          </span>
          <Badge variant="outline" className={cn("text-[10px] h-5 border", getGroupColor(technique.grupo_tecnica))}>
            {technique.grupo_tecnica}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Maximize2 className="h-3 w-3" />
            até {technique.efetiva_largura_max} × {technique.efetiva_altura_max} cm
          </span>
          <span>{colorLabel}</span>
          {technique.is_curved && (
            <Badge variant="outline" className="text-[10px] h-4">curvo</Badge>
          )}
        </div>
      </div>
    </button>
  );
}

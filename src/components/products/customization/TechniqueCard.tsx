/**
 * TechniqueCard — Card de técnica de gravação
 * 
 * Mostra nome, grupo, dimensões efetivas, setup e info de cores.
 * Baseado no briefing v6 (12/02/2026).
 */

import { Check, Maximize2, Star, DollarSign, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "w-full p-3 rounded-xl flex items-start gap-3 transition-all duration-200 border text-left",
              isSelected
                ? "bg-primary/5 border-primary ring-1 ring-primary/20 shadow-sm"
                : "bg-secondary/30 border-border/50 hover:bg-secondary/60 hover:border-primary/20"
            )}
            onClick={() => onSelect(technique)}
          >
            {/* Radio */}
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5 flex-shrink-0",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/30"
            )}>
              {isSelected && <Check className="h-3 w-3" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-foreground">
                    {technique.tecnica_nome}
                  </span>
                  <Badge variant="outline" className={cn("text-[10px] h-4 border uppercase font-black px-1 tracking-tighter", getGroupColor(technique.grupo_tecnica))}>
                    {technique.grupo_tecnica}
                  </Badge>
                </div>
                
                {/* Micro-metrics */}
                <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60">
                  <div className="flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    <span>4.8</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <DollarSign className="h-2.5 w-2.5" />
                    <span>$$</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-medium flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Maximize2 className="h-3 w-3 text-primary/60" />
                  até {technique.efetiva_largura_max} × {technique.efetiva_altura_max} cm
                </span>
                <span className="flex items-center gap-1.5">
                  <Palette className="h-3 w-3 text-primary/60" />
                  {colorLabel}
                </span>
                {technique.is_curved && (
                  <Badge variant="outline" className="text-[9px] h-4 bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold uppercase">curvo</Badge>
                )}
              </div>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="p-3 max-w-[240px] space-y-2 border-primary/20 bg-background/95 backdrop-blur">
          <div className="space-y-1">
            <p className="text-xs font-bold text-foreground">{technique.tecnica_nome}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Ideal para brindes premium. Oferece alta durabilidade e acabamento refinado que não descasca com o tempo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-2">
            <div className="space-y-0.5">
              <p className="text-[9px] text-muted-foreground uppercase font-bold">Resistência</p>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} className={cn("h-2.5 w-2.5", i <= 4 ? "fill-primary text-primary" : "text-muted")} />)}
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] text-muted-foreground uppercase font-bold">Produção</p>
              <div className="flex items-center gap-1 text-[10px] font-bold text-foreground">
                <Clock className="h-2.5 w-2.5" /> 5-7 dias
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

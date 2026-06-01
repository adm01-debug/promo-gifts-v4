// src/components/simulator/NicheRecommendationBadge.tsx
// Melhoria #3: Recomendação inteligente por nicho do cliente

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mapeamento de nichos/ramos para técnicas recomendadas
const NICHE_TECHNIQUE_MAP: Record<string, { techniques: string[]; reason: string }> = {
  // Tecnologia
  tecnologia: { techniques: ['LASER', 'UV', 'DTF'], reason: 'Acabamento premium e moderno' },
  tech: { techniques: ['LASER', 'UV', 'DTF'], reason: 'Acabamento premium e moderno' },
  software: { techniques: ['LASER', 'UV'], reason: 'Elegância e durabilidade' },
  ti: { techniques: ['LASER', 'UV', 'DTF'], reason: 'Visual tecnológico' },

  // Saúde
  saude: { techniques: ['BORD', 'SUB'], reason: 'Durável e higiênico' },
  saúde: { techniques: ['BORD', 'SUB'], reason: 'Durável e higiênico' },
  hospital: { techniques: ['BORD', 'SUB'], reason: 'Resistente a lavagens' },
  clinica: { techniques: ['BORD', 'SUB', 'LASER'], reason: 'Profissional e durável' },
  clínica: { techniques: ['BORD', 'SUB', 'LASER'], reason: 'Profissional e durável' },

  // Educação
  educacao: { techniques: ['SILK', 'SERIGRAFIA', 'DTF'], reason: 'Custo-benefício em volume' },
  educação: { techniques: ['SILK', 'SERIGRAFIA', 'DTF'], reason: 'Custo-benefício em volume' },
  escola: { techniques: ['SILK', 'SERIGRAFIA'], reason: 'Econômico para grandes quantidades' },
  universidade: { techniques: ['SILK', 'BORD', 'DTF'], reason: 'Institucional e durável' },

  // Alimentício
  alimenticio: { techniques: ['UV', 'LASER', 'SUB'], reason: 'Seguro para alimentos' },
  alimentício: { techniques: ['UV', 'LASER', 'SUB'], reason: 'Seguro para alimentos' },
  restaurante: { techniques: ['BORD', 'SILK'], reason: 'Resistente a lavagens frequentes' },
  gastronomia: { techniques: ['LASER', 'BORD'], reason: 'Elegante e profissional' },

  // Construção
  construcao: { techniques: ['SILK', 'TRANSFER'], reason: 'Resistente e visível' },
  construção: { techniques: ['SILK', 'TRANSFER'], reason: 'Resistente e visível' },
  imobiliaria: { techniques: ['LASER', 'UV', 'BORD'], reason: 'Sofisticado e premium' },
  imobiliária: { techniques: ['LASER', 'UV', 'BORD'], reason: 'Sofisticado e premium' },

  // Varejo
  varejo: { techniques: ['SILK', 'DTF', 'TRANSFER'], reason: 'Volume e versatilidade' },
  comercio: { techniques: ['SILK', 'DTF'], reason: 'Custo-benefício' },
  comércio: { techniques: ['SILK', 'DTF'], reason: 'Custo-benefício' },
  loja: { techniques: ['SILK', 'DTF', 'SUB'], reason: 'Visual atrativo' },

  // Esportivo
  esporte: { techniques: ['SUB', 'DTF', 'TRANSFER'], reason: 'Cores vibrantes e flexível' },
  academia: { techniques: ['SUB', 'DTF'], reason: 'Resistente ao suor' },
  fitness: { techniques: ['SUB', 'DTF', 'TRANSFER'], reason: 'Secagem rápida' },

  // Automotivo
  automotivo: { techniques: ['LASER', 'UV', 'GRAVACAO'], reason: 'Resistente e duradouro' },
  automoveis: { techniques: ['LASER', 'UV'], reason: 'Acabamento premium' },

  // Eventos
  eventos: { techniques: ['DTF', 'SUB', 'SILK'], reason: 'Entrega rápida e cores vivas' },
  marketing: { techniques: ['DTF', 'SUB', 'SILK'], reason: 'Impactante e versátil' },
  publicidade: { techniques: ['DTF', 'SUB', 'UV'], reason: 'Cores vibrantes' },

  // Corporativo
  corporativo: { techniques: ['BORD', 'LASER', 'UV'], reason: 'Elegante e profissional' },
  empresarial: { techniques: ['BORD', 'LASER'], reason: 'Institucional e durável' },
  escritorio: { techniques: ['LASER', 'UV', 'TAMPOGRAFIA'], reason: 'Sofisticado' },
  escritório: { techniques: ['LASER', 'UV', 'TAMPOGRAFIA'], reason: 'Sofisticado' },
};

interface NicheRecommendationBadgeProps {
  techniqueCode: string;
  clientRamo: string | null | undefined;
  clientNicho: string | null | undefined;
  className?: string;
}

export function NicheRecommendationBadge({
  techniqueCode,
  clientRamo,
  clientNicho,
  className,
}: NicheRecommendationBadgeProps) {
  const recommendation = useMemo(() => {
    if (!clientRamo && !clientNicho) return null;

    const searchTerms = [clientRamo, clientNicho]
      .filter((t): t is string => Boolean(t))
      .map((t) => t.toLowerCase());

    for (const term of searchTerms) {
      for (const [key, value] of Object.entries(NICHE_TECHNIQUE_MAP)) {
        if (term.includes(key) || key.includes(term)) {
          const isRecommended = value.techniques.some((t) =>
            techniqueCode.toUpperCase().includes(t),
          );
          if (isRecommended) {
            return {
              isRecommended: true,
              reason: value.reason,
              matchedNiche: key,
            };
          }
        }
      }
    }

    return null;
  }, [techniqueCode, clientRamo, clientNicho]);

  if (!recommendation) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'cursor-help gap-1 border-primary/30 bg-primary/10 text-[10px] text-primary',
              className,
            )}
          >
            <Target className="h-3 w-3" />
            Recomendado
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="space-y-1">
            <p className="flex items-center gap-1 font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Ideal para o nicho do cliente
            </p>
            <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Hook para obter recomendações por nicho
export function useNicheRecommendations(
  clientRamo: string | null | undefined,
  clientNicho: string | null | undefined,
) {
  return useMemo(() => {
    if (!clientRamo && !clientNicho) {
      return {
        hasRecommendations: false,
        recommendedCodes: [] as string[],
        reason: null as string | null,
      };
    }

    const searchTerms = [clientRamo, clientNicho]
      .filter((t): t is string => Boolean(t))
      .map((t) => t.toLowerCase());

    const allRecommendedCodes: string[] = [];
    let reason: string | null = null;

    for (const term of searchTerms) {
      for (const [key, value] of Object.entries(NICHE_TECHNIQUE_MAP)) {
        if (term.includes(key) || key.includes(term)) {
          allRecommendedCodes.push(...value.techniques);
          if (!reason) reason = value.reason;
        }
      }
    }

    return {
      hasRecommendations: allRecommendedCodes.length > 0,
      recommendedCodes: [...new Set(allRecommendedCodes)],
      reason,
    };
  }, [clientRamo, clientNicho]);
}

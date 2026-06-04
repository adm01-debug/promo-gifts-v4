/**
 * PackagingBadge - Badge clicável para produtos com embalagem especial
 * Exibe quando has_commercial_packaging === true
 */
import { Gift, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PackagingContext = 'always' | 'with_customization' | 'without_customization' | null;

interface PackagingBadgeProps {
  hasCommercialPackaging: boolean | null;
  packingType: string | null;
  repackingType: string | null;
  packagingContext: PackagingContext;
  onClick: () => void;
  className?: string;
  boxWidthMm?: number | null;
  boxHeightMm?: number | null;
  boxLengthMm?: number | null;
}

// Mapeamento de contexto para texto de exibição
const contextLabels: Record<string, string> = {
  always: 'Sempre disponível',
  with_customization: 'Com personalização',
  without_customization: 'Sem personalização',
};

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function PackagingBadge({
  hasCommercialPackaging,
  packingType,
  repackingType,
  packagingContext,
  onClick,
  className,
  boxWidthMm,
  boxHeightMm,
  boxLengthMm,
}: PackagingBadgeProps) {
  // Só exibir se has_commercial_packaging === true
  if (!hasCommercialPackaging) {
    return null;
  }

  // Determinar tipo de embalagem baseado no contexto
  const displayType =
    packagingContext === 'with_customization'
      ? repackingType || packingType || 'Embalagem Especial'
      : packingType || 'Embalagem Especial';

  // Texto do contexto
  const contextText = packagingContext ? contextLabels[packagingContext] : null;

  const dimensions = [boxWidthMm, boxHeightMm, boxLengthMm].filter(Boolean).join(' × ');

  const badge = (
    <Badge
      variant="outline"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Embalagem especial: ${displayType}. ${contextText ? `Regra: ${contextText}.` : ''} Clique para ver mais detalhes.`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group/packaging cursor-pointer transition-all duration-200',
        'bg-gradient-to-r from-warning/10 to-warning/5',
        'border-warning/30 hover:border-warning/60',
        'hover:from-warning/20 hover:to-warning/10',
        'will-change-transform hover:scale-[1.02] hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2',
        'flex-col items-start gap-0.5 px-3 py-1.5',
        className,
      )}
    >
      <div className="flex items-center">
        <Gift className="mr-1.5 h-3.5 w-3.5 text-warning transition-transform group-hover/packaging:scale-110" />
        <span className="text-xs font-medium text-warning-foreground">{displayType}</span>
        <ChevronRight className="ml-1 h-3 w-3 text-warning/60 transition-transform group-hover/packaging:translate-x-0.5" />
      </div>
      {contextText && <span className="pl-5 text-[10px] text-muted-foreground">{contextText}</span>}
    </Badge>
  );

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="pointer-events-none max-w-[200px]">
        <div className="space-y-1.5 text-xs">
          <p className="font-semibold text-foreground">Embalagem {displayType}</p>
          <div className="grid gap-1 text-[10px] text-muted-foreground">
            {packingType && (
              <p>
                <span className="font-medium text-foreground">Tipo:</span> {packingType}
              </p>
            )}
            {dimensions && (
              <p>
                <span className="font-medium text-foreground">Medidas:</span> {dimensions} mm
              </p>
            )}
            {contextText && (
              <p>
                <span className="font-medium text-foreground">Contexto:</span> {contextText}
              </p>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

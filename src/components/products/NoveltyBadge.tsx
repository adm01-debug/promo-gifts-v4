import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles } from 'lucide-react';

interface NoveltyBadgeProps {
  daysRemaining: number;
  showDays?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Badge de novidade com cores dinâmicas baseadas na recência:
 * - Verde vibrante: muito novo (≤5 dias desde criação)
 * - Verde: novo (6-15 dias)
 * - Amarelo: moderado (16-23 dias)
 * - Laranja: quase saindo (24-30 dias)
 */
export function NoveltyBadge({
  daysRemaining,
  showDays = true,
  size = 'md',
  className,
}: NoveltyBadgeProps) {
  const daysElapsed = 30 - daysRemaining;

  const getVariantClasses = () => {
    if (daysElapsed <= 5) {
      // Very fresh — vibrant success green with glow
      return 'bg-success text-success-foreground shadow-[0_0_0_1px_hsl(var(--success)/0.3),0_2px_8px_hsl(var(--success)/0.25)] hover:shadow-[0_0_0_1px_hsl(var(--success)/0.4),0_4px_12px_hsl(var(--success)/0.35)]';
    }
    if (daysElapsed <= 15) {
      // Fresh — success
      return 'bg-success/80 text-success-foreground';
    }
    if (daysElapsed <= 23) {
      // Moderate — warning
      return 'bg-warning/80 text-warning-foreground';
    }
    // Aging — orange
    return 'bg-brand-primary/80 text-brand-primary-foreground';
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-[9px] px-1.5 py-0.5 gap-0.5';
      case 'lg':
        return 'text-sm px-3 py-1.5 gap-1.5';
      default:
        return 'text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 gap-1';
    }
  };

  const getLabel = () => {
    if (daysElapsed === 0) return 'Novidade hoje!';
    if (daysElapsed === 1) return 'Novidade 1 dia';
    return `Novidade ${daysElapsed} dias`;
  };

  const content = (
    <Badge
      className={cn(
        'inline-flex items-center rounded-full font-semibold transition-shadow duration-300',
        getVariantClasses(),
        getSizeClasses(),
        daysElapsed <= 2 && 'animate-[badge-pop_0.4s_ease-out]',
        className,
      )}
    >
      {daysElapsed <= 5 && (
        <Sparkles
          className={cn(
            size === 'sm' ? 'h-2.5 w-2.5' : size === 'lg' ? 'h-4 w-4' : 'h-2.5 w-2.5 sm:h-3 sm:w-3',
          )}
        />
      )}
      <span>{showDays ? getLabel() : 'Novidade'}</span>
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="text-sm">
          <p className="font-semibold">🆕 Produto Novidade</p>
          <p className="text-muted-foreground">
            {daysElapsed === 0
              ? 'Adicionado hoje!'
              : daysElapsed === 1
                ? 'Adicionado ontem'
                : `Adicionado há ${daysElapsed} dias`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Restam {daysRemaining}d como novidade
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Badge compacto para uso em listas
 */
export function NoveltyBadgeCompact({
  daysRemaining,
  className,
}: {
  daysRemaining: number;
  className?: string;
}) {
  return (
    <NoveltyBadge daysRemaining={daysRemaining} size="sm" showDays={true} className={className} />
  );
}

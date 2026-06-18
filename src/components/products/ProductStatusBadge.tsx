import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sparkles, Package, TrendingUp, Clock, Tag, Gift } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBadgeVisibilityStore } from '@/stores/useBadgeVisibilityStore';
import { useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { noveltyDaysElapsed, noveltyBadgeLabelFromElapsed } from '@/lib/products/novelty-days';

export type ProductStatusBadgeType =
  | 'novelty'
  | 'promotion'
  | 'featured'
  | 'kit'
  | 'urgency'
  | 'out-of-stock'
  | 'packaging';

export type UrgencyType = 'limited-stock' | 'trending' | 'ending-soon';

interface PackagingMetadata {
  packingType?: string | null;
  boxWidthMm?: number | null;
  boxHeightMm?: number | null;
  boxLengthMm?: number | null;
  packagingContext?: 'always' | 'with_customization' | 'without_customization' | null;
}

const PACKAGING_CONTEXT_LABELS: Record<string, string> = {
  always: 'Sempre disponível',
  with_customization: 'Com personalização',
  without_customization: 'Sem personalização',
} as const;

interface ProductStatusBadgeProps {
  type: ProductStatusBadgeType;
  urgencyType?: UrgencyType;
  value?: string | number;
  daysRemaining?: number;
  /**
   * Idade da novidade em dias (desde a detecção). Quando fornecido, é usado
   * diretamente no badge "Novidade X dias" e nas faixas de cor. Caso contrário,
   * cai no comportamento legado (`30 - daysRemaining`, janela fixa de 30 dias).
   * Necessário desde que o módulo Novidades passou a usar a janela real da
   * pipeline (~60 dias), onde `30 - daysRemaining` produziria valores negativos.
   */
  daysElapsed?: number;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  showTooltip?: boolean;
  packagingMetadata?: PackagingMetadata;
}

export function ProductStatusBadge({
  type,
  urgencyType,
  value,
  daysRemaining,
  daysElapsed,
  size = 'md',
  onClick,
  className,
  showTooltip = true,
  packagingMetadata,
}: ProductStatusBadgeProps) {
  const location = useLocation();
  const { actualTheme } = useTheme();

  // Idade da novidade (dias desde a detecção). Preferir o valor explícito
  // (passado pelo módulo Novidades, que usa a janela real ~60d da pipeline);
  // senão, fallback legado via lib (30 - daysRemaining, já clampado em 0).
  const resolvedNoveltyElapsed = daysElapsed ?? noveltyDaysElapsed(daysRemaining);

  const badgesEnabled = useBadgeVisibilityStore((s) => {
    const settings = s.routeSettings[location.pathname];
    if (settings) {
      return actualTheme === 'dark' ? settings.dark : settings.light;
    }
    return s.badgesEnabled;
  });

  // Hide all status badges when user has disabled them.
  // Exceção: urgências contextuais permanecem visíveis, EXCETO "limited-stock"
  // (badge "Estoque baixo"), que deve respeitar o toggle global como as demais
  // badges de status de estoque (out-of-stock, etc.).
  if (!badgesEnabled) {
    const isToggleableUrgency = type === 'urgency' && urgencyType === 'limited-stock';
    if (type !== 'urgency' || isToggleableUrgency) return null;
  }

  const isClickable = !!onClick;

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

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'h-2.5 w-2.5';
      case 'lg':
        return 'h-4 w-4';
      default:
        return 'h-2.5 w-2.5 sm:h-3 sm:w-3';
    }
  };

  const getVariantStyles = () => {
    switch (type) {
      case 'featured':
        return 'bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-lg animate-glow-pulse';
      case 'kit':
        return 'bg-gradient-to-r from-warning to-warning/80 text-warning-foreground shadow-md';
      case 'out-of-stock':
        return 'bg-destructive text-destructive-foreground shadow-md';
      case 'packaging':
        return 'bg-gradient-to-r from-warning/90 to-warning text-warning-foreground shadow-md';
      case 'promotion':
        return 'animate-pulse bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground shadow-md';
      case 'novelty': {
        // Badge "NEW" (canto direito) — rosa choque, alto contraste
        if (value === 'NEW') {
          return 'bg-[#FF1493] text-white font-bold shadow-[0_2px_8px_rgba(255,20,147,0.4)] ring-1 ring-white/20';
        }
        // Badge "Novidade X dias" (canto esquerdo) — cor por faixa, sempre legível
        const daysElapsed = resolvedNoveltyElapsed;
        if (daysElapsed <= 5) {
          // Recém-chegado — azul vívido
          return 'bg-[#2563EB] text-white font-semibold shadow-[0_2px_8px_rgba(37,99,235,0.35)]';
        }
        if (daysElapsed <= 15) {
          // Ainda fresco — roxo
          return 'bg-[#7C3AED] text-white font-semibold shadow-[0_2px_8px_rgba(124,58,237,0.35)]';
        }
        if (daysElapsed <= 23) {
          // Meio da janela — âmbar com texto escuro p/ contraste
          return 'bg-[#F59E0B] text-[#1F1300] font-bold shadow-[0_2px_8px_rgba(245,158,11,0.35)]';
        }
        // Saindo da janela — laranja queimado
        return 'bg-[#EA580C] text-white font-semibold shadow-[0_2px_8px_rgba(234,88,12,0.35)]';
      }
      case 'urgency':
        switch (urgencyType) {
          case 'limited-stock':
            return 'bg-warning text-warning-foreground shadow-md';

          case 'trending':
            return 'bg-primary/90 text-primary-foreground';
          case 'ending-soon':
            return 'bg-warning/90 text-warning-foreground';
          default:
            return 'bg-muted text-muted-foreground';
        }
      default:
        return 'bg-primary text-primary-foreground';
    }
  };

  const getContent = () => {
    const iconSize = getIconSize();

    switch (type) {
      case 'featured':
        return (
          <>
            <Sparkles className={iconSize} />
            <span className={cn(size === 'sm' && 'hidden sm:inline')}>Destaque</span>
            {size === 'sm' && <span className="sm:hidden">★</span>}
          </>
        );
      case 'out-of-stock':
        return (
          <>
            <Package className={iconSize} />
            <span>{value || 'Estoque zerado'}</span>
          </>
        );
      case 'kit':
        return (
          <>
            <Package className={iconSize} />
            <span>Kit</span>
          </>
        );
      case 'promotion':
        return (
          <>
            <Tag className={iconSize} />
            <span>{value || 'Promoção'}</span>
          </>
        );
      case 'packaging':
        return (
          <>
            <Gift className={iconSize} />
            <span>{value || 'Embalagem'}</span>
          </>
        );
      case 'novelty': {
        const daysElapsed = resolvedNoveltyElapsed;
        const label = noveltyBadgeLabelFromElapsed(daysElapsed);
        return (
          <>
            {daysElapsed <= 5 && <Sparkles className={iconSize} />}
            <span>{value || label}</span>
          </>
        );
      }
      case 'urgency':
        switch (urgencyType) {
          case 'limited-stock':
            return (
              <>
                <Package className={iconSize} />
                <span>{value || 'Estoque limitado'}</span>
              </>
            );
          case 'trending':
            return (
              <>
                <TrendingUp className={iconSize} />
                <span>{value || 'Em alta'}</span>
              </>
            );
          case 'ending-soon':
            return (
              <>
                <Clock className={iconSize} />
                <span>{value || 'Termina em breve'}</span>
              </>
            );
        }
        break;
    }
    return <span>{value}</span>;
  };

  const getTooltipContent = () => {
    switch (type) {
      case 'novelty': {
        const daysElapsed = resolvedNoveltyElapsed;
        return (
          <div className="text-sm">
            <p className="font-semibold">🆕 Produto Novidade</p>
            <p className="text-muted-foreground">
              {daysElapsed === 0 ? 'Adicionado hoje!' : `Adicionado há ${daysElapsed} dias`}
            </p>
            {daysRemaining !== undefined && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Restam {daysRemaining}d como novidade
              </p>
            )}
          </div>
        );
      }
      case 'promotion':
        return (
          <div className="text-sm">
            <p className="font-semibold">🏷️ Oferta Especial</p>
            <p className="text-muted-foreground">Aproveite os descontos exclusivos</p>
          </div>
        );
      case 'featured':
        return (
          <div className="text-sm">
            <p className="font-semibold">✨ Produto em Destaque</p>
            <p className="text-muted-foreground">Selecionado pela nossa curadoria</p>
          </div>
        );
      case 'packaging': {
        const { packingType, boxWidthMm, boxHeightMm, boxLengthMm, packagingContext } =
          packagingMetadata || {};
        const dimensions = [boxWidthMm, boxHeightMm, boxLengthMm].filter(Boolean).join(' × ');
        return (
          <div className="space-y-1.5 p-1 text-sm">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-warning" />
              <p className="font-semibold text-foreground">Embalagem Especial</p>
            </div>
            <div className="grid gap-1 text-[11px] text-muted-foreground">
              {packingType && (
                <p>
                  <span className="font-medium text-foreground">Tipo:</span> {packingType}
                </p>
              )}
              {dimensions && (
                <p>
                  <span className="font-medium text-foreground">Dimensões:</span> {dimensions} mm
                </p>
              )}
              {packagingContext && PACKAGING_CONTEXT_LABELS[packagingContext] && (
                <p>
                  <span className="font-medium text-foreground">Regra:</span>{' '}
                  {PACKAGING_CONTEXT_LABELS[packagingContext]}
                </p>
              )}
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const badge = (
    <Badge
      tabIndex={0}
      role={isClickable ? 'button' : 'status'}
      aria-label={
        type === 'packaging'
          ? 'Produto com embalagem especial configurada. Ver detalhes.'
          : typeof value === 'string'
            ? value
            : String(type)
      }
      className={cn(
        'inline-flex items-center rounded-full font-semibold transition-all duration-300',
        'group-hover:scale-105 group-hover:shadow-lg',
        'will-change-transform hover:brightness-110 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'max-w-full truncate whitespace-nowrap', // Prevent text overflow, though flex-wrap handles the layout
        isClickable && 'pointer-events-auto cursor-pointer',
        getVariantStyles(),
        getSizeClasses(),
        'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
        className,
      )}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          (e.currentTarget as HTMLElement).click();
        }
      }}
    >
      {getContent()}
    </Badge>
  );

  const tooltipContent = getTooltipContent();
  if (showTooltip && tooltipContent) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="pointer-events-none">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}

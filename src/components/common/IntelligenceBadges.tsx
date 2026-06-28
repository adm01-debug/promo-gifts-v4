/**
 * IntelligenceBadges — renders market intelligence badges on product pages.
 * Data-driven from useProductIntelligenceBadges hook.
 */
import { Flame, Zap, Rocket, AlertTriangle, Sparkles, Star, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useBadgeVisibilityStore } from '@/stores/useBadgeVisibilityStore';
import type { IntelligenceBadge } from '@/hooks/products';

type IntelligenceBadgeType = IntelligenceBadge['type'];

const badgeConfig: Record<
  IntelligenceBadgeType,
  {
    icon: typeof Flame;
    colors: string;
    animation?: string;
  }
> = {
  featured: {
    icon: Sparkles,
    colors: 'bg-primary/15 text-primary border-primary/30',
  },
  'new-arrival': {
    icon: Star,
    colors: 'bg-primary/15 text-primary border-primary/30',
  },
  'hot-item': {
    icon: Flame,
    colors: 'bg-primary/15 text-primary border-primary/30',
    animation: 'animate-pulse',
  },
  emerging: {
    icon: Rocket,
    colors: 'bg-primary/15 text-primary border-primary/30',
    animation: 'animate-pulse',
  },
  declining: {
    icon: AlertTriangle,
    colors: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  'frequent-restock': {
    icon: Zap,
    colors: 'bg-primary/15 text-primary border-primary/30',
  },
  'last-units': {
    icon: AlertTriangle,
    colors: 'bg-destructive/15 text-destructive border-destructive/30',
    animation: 'animate-pulse',
  },
  'best-seller': {
    icon: Flame,
    colors: 'bg-primary/15 text-primary border-primary/30',
  },
  'class-a': {
    icon: Tag,
    colors: 'bg-primary/15 text-primary border-primary/30',
  },
};

interface IntelligenceBadgesProps {
  badges: IntelligenceBadge[];
  turnoverScore?: number | null;
  isDemo?: boolean;
  className?: string;
}

export function IntelligenceBadges({
  badges,
  turnoverScore,
  isDemo,
  className,
}: IntelligenceBadgesProps) {
  // Respeita o toggle global "Etiquetas dos Produtos" do Header.
  // Quando desligado, intelligence badges (hot-item, best-seller, etc.)
  // são ocultados junto com todos os demais badges de status/marketing.
  // fix_version: badge-toggle-v2 — IntelligenceBadges agora controlado pelo toggle
  const location = useLocation();
  const { actualTheme } = useTheme();
  const badgesEnabled = useBadgeVisibilityStore((s) => {
    const settings = s.routeSettings[location.pathname];
    if (settings) {
      return actualTheme === 'dark' ? settings.dark : settings.light;
    }
    return s.badgesEnabled;
  });

  if (!badgesEnabled || !badges.length) return null;

  return (
    <div className={cn('stagger-children flex flex-wrap items-center gap-2', className)}>
      {badges.map((badge) => {
        const config = badgeConfig[badge.type];
        const Icon = config.icon;

        return (
          <Tooltip key={badge.type}>
            <TooltipTrigger asChild>
              <div data-testid={`intelligence-badge-${badge.type}`}>
                <Badge
                  variant="outline"
                  className={cn(
                    'cursor-default gap-1.5 border px-2.5 py-1 text-xs font-semibold',
                    config.colors,
                    config.animation,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {badge.icon} {badge.label}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-[260px] text-center"
              data-testid={`intelligence-badge-${badge.type}-tooltip`}
            >
              <p className="font-medium">{badge.label}</p>
              {badge.description ? (
                <p className="mt-1 text-xs text-muted-foreground">{badge.description}</p>
              ) : null}
            </TooltipContent>
          </Tooltip>

        );
      })}

      {turnoverScore !== null && turnoverScore !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="secondary" className="cursor-default font-mono text-xs">
                Potencial: {turnoverScore}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-center">
            <p>
              {turnoverScore >= 80
                ? 'Alto potencial comercial'
                : turnoverScore >= 50
                  ? 'Bom potencial comercial'
                  : turnoverScore >= 20
                    ? 'Potencial moderado'
                    : 'Potencial baixo'}
            </p>
          </TooltipContent>
        </Tooltip>
      )}

      {isDemo && (
        <Badge
          variant="outline"
          className="border-border px-1.5 py-0 text-[10px] text-muted-foreground"
        >
          dados ilustrativos
        </Badge>
      )}
    </div>
  );
}

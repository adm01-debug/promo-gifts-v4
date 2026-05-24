/**
 * IntelligenceBadges — renders market intelligence badges on product pages.
 * Data-driven from useProductIntelligenceBadges hook.
 */
import { motion } from 'framer-motion';
import { Flame, Zap, Rocket, AlertTriangle, Sparkles, Star, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
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
  if (!badges.length) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {badges.map((badge, i) => {
        const config = badgeConfig[badge.type];
        const Icon = config.icon;

        return (
          <Tooltip key={badge.type}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 300 }}
              >
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
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-center">
              <p className="text-xs">{badge.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {turnoverScore !== null && turnoverScore !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: badges.length * 0.1 }}
            >
              <Badge variant="secondary" className="cursor-default font-mono text-xs">
                Potencial: {turnoverScore}
              </Badge>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px] text-center">
            <p className="text-xs">
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

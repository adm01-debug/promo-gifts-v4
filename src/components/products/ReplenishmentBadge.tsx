import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw } from 'lucide-react';

interface ReplenishmentBadgeProps {
  daysSince: number;
  showDays?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ReplenishmentBadge({
  daysSince,
  showDays = true,
  size = 'md',
  className,
}: ReplenishmentBadgeProps) {
  const getVariantClasses = () => {
    if (daysSince <= 2)
      return 'bg-info text-info-foreground shadow-[0_0_0_1px_hsl(var(--info)/0.3),0_2px_8px_hsl(var(--info)/0.25)] hover:shadow-[0_0_0_1px_hsl(var(--info)/0.4),0_4px_12px_hsl(var(--info)/0.35)]';
    if (daysSince <= 7) return 'bg-info/80 text-info-foreground';
    if (daysSince <= 20) return 'bg-warning/80 text-warning-foreground';
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
    if (daysSince === 0) return 'Reposição hoje!';
    if (daysSince === 1) return 'Reposição 1 dia';
    return `Reposição ${daysSince} dias`;
  };

  const daysRemaining = Math.max(0, 30 - daysSince);

  const content = (
    <Badge
      className={cn(
        'inline-flex items-center rounded-full font-semibold transition-shadow duration-300',
        getVariantClasses(),
        getSizeClasses(),
        daysSince <= 2 && 'animate-[badge-pop_0.4s_ease-out]',
        className,
      )}
    >
      {daysSince <= 5 && (
        <RefreshCw
          className={cn(
            size === 'sm' ? 'h-2.5 w-2.5' : size === 'lg' ? 'h-4 w-4' : 'h-2.5 w-2.5 sm:h-3 sm:w-3',
          )}
        />
      )}
      <span>{showDays ? getLabel() : 'Reposição'}</span>
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="top">
        <div className="text-sm">
          <p className="font-semibold">🔄 Produto Reposto</p>
          <p className="text-muted-foreground">
            {daysSince === 0
              ? 'Reposto hoje!'
              : daysSince === 1
                ? 'Reposto ontem'
                : `Reposto há ${daysSince} dias`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Restam {daysRemaining}d como reposição
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ReplenishmentBadgeCompact({
  daysSince,
  className,
}: {
  daysSince: number;
  className?: string;
}) {
  return <ReplenishmentBadge daysSince={daysSince} size="sm" showDays className={className} />;
}

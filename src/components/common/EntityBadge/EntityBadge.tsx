import React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Generic entity badge — base for MaterialBadge, RamoAtividadeBadge, etc.
 *
 * Pattern extracted in F1 Onda D (auditoria de duplicação): two near-identical
 * 177-line components were merged into this generic component + thin wrappers.
 *
 * Behavior:
 * - Optional color dot from `hexCode`.
 * - Optional contextual label rendered before name with `groupSeparator`.
 * - Optional `icon` rendered before color dot (e.g. for "Ramo de Atividade").
 * - Optional remove button (`onRemove`).
 * - Optional tooltip (auto-rendered when `groupLabel` or `productCount` set).
 */
const BADGE_SIZE_CLASSES = {
  sm: 'text-[11px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
} as const;

const BADGE_DOT_SIZE_CLASSES = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
} as const;

const BADGE_VARIANT_CLASSES = {
  default: 'bg-muted text-muted-foreground hover:bg-muted/80',
  outline: 'border border-border bg-transparent hover:bg-muted/50',
  solid: 'bg-foreground text-background hover:bg-foreground/90',
  ghost: 'bg-transparent text-muted-foreground hover:bg-muted/50',
} as const;

export interface EntityBadgeProps {
  /** Name shown as badge label (always rendered) */
  name: string;
  /** Optional contextual label (e.g. "Plásticos" for a material; "Hotel" for a ramo) */
  groupLabel?: string;
  /** Hex color for the leading dot. If null/undefined, dot is omitted. */
  hexCode?: string | null;
  /** Optional emoji or single-character icon shown before the dot */
  icon?: string | null;
  /** Visual size */
  size?: 'lg' | 'md' | 'sm';
  /** Visual variant */
  variant?: 'default' | 'ghost' | 'outline' | 'solid';
  /** When true and `groupLabel` is set, renders `${groupLabel}${groupSeparator}${name}` */
  showGroup?: boolean;
  /** Separator between group label and name. Default: ": " */
  groupSeparator?: string;
  /** Click handler (full badge) */
  onClick?: () => void;
  /** Remove handler — when set, renders an `×` button */
  onRemove?: () => void;
  /** Extra classes merged via cn() */
  className?: string;
  /** Disable tooltip render even when context exists */
  showTooltip?: boolean;
  /** Number of products linked — appended to tooltip when present */
  productCount?: number;
  /** Per-size cap for the label (Tailwind max-width classes) */
  truncateMaxWidth?: { sm: string; md: string; lg: string };
  /** Tooltip content override — when not provided, builds from groupLabel + productCount */
  tooltipContent?: React.ReactNode;
}

const DEFAULT_MAX_WIDTH = {
  sm: 'max-w-[100px]',
  md: 'max-w-[120px]',
  lg: 'max-w-[150px]',
};

export function EntityBadge({
  name,
  groupLabel,
  hexCode,
  icon,
  size = 'md',
  variant = 'default',
  showGroup = false,
  groupSeparator = ': ',
  onClick,
  onRemove,
  className,
  showTooltip = true,
  productCount,
  truncateMaxWidth = DEFAULT_MAX_WIDTH,
  tooltipContent,
}: EntityBadgeProps) {
  const displayText = showGroup && groupLabel ? `${groupLabel}${groupSeparator}${name}` : name;

  const badgeContent = (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-colors',
        BADGE_SIZE_CLASSES[size],
        BADGE_VARIANT_CLASSES[variant],
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      {icon && <span className="leading-none">{icon}</span>}
      {hexCode && (
        <span
          className={cn('shrink-0 rounded-full', BADGE_DOT_SIZE_CLASSES[size])}
          style={{ backgroundColor: hexCode }}
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          'truncate',
          size === 'sm' && truncateMaxWidth.sm,
          size === 'md' && truncateMaxWidth.md,
          size === 'lg' && truncateMaxWidth.lg,
        )}
      >
        {displayText}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'shrink-0 rounded-full transition-colors hover:bg-foreground/10',
            size === 'sm' && 'p-0.5',
            size === 'md' && 'p-0.5',
            size === 'lg' && 'p-1',
          )}
          aria-label={`Remover ${name}`}
        >
          <X
            className={cn(
              size === 'sm' && 'h-2.5 w-2.5',
              size === 'md' && 'h-3 w-3',
              size === 'lg' && 'h-3.5 w-3.5',
            )}
          />
        </button>
      )}
    </span>
  );

  // Default tooltip text (when not overridden)
  const defaultTooltip = (
    <>
      {groupLabel && <div className="font-medium">{groupLabel}</div>}
      <div>{name}</div>
      {productCount !== undefined && (
        <div className="mt-1 text-xs opacity-80">
          {productCount} produto{productCount !== 1 ? 's' : ''}
        </div>
      )}
    </>
  );

  // With tooltip
  if (showTooltip && (groupLabel || productCount !== undefined)) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent>{tooltipContent ?? defaultTooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}

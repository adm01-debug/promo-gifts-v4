import { EntityBadge } from '@/components/common/EntityBadge';

/**
 * Badge for displaying a Material (Plástico, Metal, Tecido, etc).
 *
 * Thin wrapper around `EntityBadge` — see common/EntityBadge for the actual
 * implementation. API kept identical for backwards compatibility with all
 * existing callers.
 */
interface MaterialBadgeProps {
  name: string;
  groupName?: string;
  hexCode?: string | null;
  size?: 'lg' | 'md' | 'sm';
  variant?: 'default' | 'ghost' | 'outline' | 'solid';
  showGroup?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
  showTooltip?: boolean;
  productCount?: number;
}

export function MaterialBadge({
  name,
  groupName,
  hexCode,
  size = 'md',
  variant = 'default',
  showGroup = false,
  onClick,
  onRemove,
  className,
  showTooltip = true,
  productCount,
}: MaterialBadgeProps) {
  return (
    <EntityBadge
      name={name}
      groupLabel={groupName}
      hexCode={hexCode}
      size={size}
      variant={variant}
      showGroup={showGroup}
      groupSeparator=": "
      onClick={onClick}
      onRemove={onRemove}
      className={className}
      showTooltip={showTooltip}
      productCount={productCount}
    />
  );
}

import { EntityBadge } from '@/components/common/EntityBadge';

/**
 * Badge for displaying a Ramo de Atividade (Hotel, Restaurante, Imobiliária, etc).
 *
 * Thin wrapper around `EntityBadge` — see common/EntityBadge for the actual
 * implementation. API kept identical for backwards compatibility with all
 * existing callers.
 */
interface RamoAtividadeBadgeProps {
  name: string;
  ramoName?: string;
  hexCode?: string | null;
  icon?: string | null;
  size?: 'lg' | 'md' | 'sm';
  variant?: 'default' | 'ghost' | 'outline' | 'solid';
  showRamo?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
  showTooltip?: boolean;
  productCount?: number;
}

const RAMO_MAX_WIDTH = {
  sm: 'max-w-[100px]',
  md: 'max-w-[140px]',
  lg: 'max-w-[180px]',
};

export function RamoAtividadeBadge({
  name,
  ramoName,
  hexCode,
  icon,
  size = 'md',
  variant = 'default',
  showRamo = false,
  onClick,
  onRemove,
  className,
  showTooltip = true,
  productCount,
}: RamoAtividadeBadgeProps) {
  return (
    <EntityBadge
      name={name}
      groupLabel={ramoName}
      hexCode={hexCode}
      icon={icon}
      size={size}
      variant={variant}
      showGroup={showRamo}
      groupSeparator=" → "
      onClick={onClick}
      onRemove={onRemove}
      className={className}
      showTooltip={showTooltip}
      productCount={productCount}
      truncateMaxWidth={RAMO_MAX_WIDTH}
    />
  );
}

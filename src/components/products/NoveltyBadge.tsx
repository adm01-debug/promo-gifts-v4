import { ProductStatusBadge } from './ProductStatusBadge';

interface NoveltyBadgeProps {
  daysRemaining: number;
  showDays?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Badge de novidade padronizado (wrapper para ProductStatusBadge)
 */
export function NoveltyBadge({
  daysRemaining,
  showDays = true,
  size = 'md',
  className,
  onClick,
}: NoveltyBadgeProps) {
  return (
    <ProductStatusBadge
      type="novelty"
      daysRemaining={daysRemaining}
      size={size}
      className={className}
      onClick={onClick}
      value={!showDays ? 'Novidade' : undefined}
    />
  );
}

/**
 * Badge compacto para uso em listas
 */
export function NoveltyBadgeCompact({
  daysRemaining,
  className,
  onClick,
}: {
  daysRemaining: number;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <NoveltyBadge
      daysRemaining={daysRemaining}
      size="sm"
      showDays={true}
      className={className}
      onClick={onClick}
    />
  );
}

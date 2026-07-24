import { ProductStatusBadge } from './ProductStatusBadge';

interface NoveltyBadgeProps {
  daysRemaining: number;
  /**
   * Idade da novidade (dias desde a detecção). Quando informado, o badge mostra
   * "Novidade X dias" com X = daysElapsed. Sem ele, cai no legado 30-daysRemaining.
   */
  daysElapsed?: number;
  showDays?: boolean;
  size?: 'lg' | 'md' | 'sm';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Badge de novidade padronizado (wrapper para ProductStatusBadge)
 */
export function NoveltyBadge({
  daysRemaining,
  daysElapsed,
  showDays = true,
  size = 'md',
  className,
  onClick,
}: NoveltyBadgeProps) {
  return (
    <ProductStatusBadge
      type="novelty"
      daysRemaining={daysRemaining}
      daysElapsed={daysElapsed}
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
      showDays
      className={className}
      onClick={onClick}
    />
  );
}

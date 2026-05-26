/**
 * Badge canônico de role — usar em Header, tabelas e qualquer lugar
 * que precise representar visualmente uma role do usuário.
 */
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getRoleVisual } from '@/lib/roles';

interface RoleBadgeProps {
  role: string | null | undefined;
  /** Mostra apenas o ícone (modo compacto, ex.: sidebar colapsada). */
  iconOnly?: boolean;
  /** Esconde o ícone, exibindo só o texto. */
  hideIcon?: boolean;
  className?: string;
}

export function RoleBadge({ role, iconOnly = false, hideIcon = false, className }: RoleBadgeProps) {
  const visual = getRoleVisual(role);
  const Icon = visual.Icon;

  return (
    <Badge
      variant={visual.variant}
      className={cn('gap-1 font-medium', visual.className, className)}
      title={visual.description}
      aria-label={visual.label}
    >
      {!hideIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {!iconOnly && <span>{visual.label}</span>}
    </Badge>
  );
}

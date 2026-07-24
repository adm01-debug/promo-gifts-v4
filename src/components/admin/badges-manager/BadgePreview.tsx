/**
 * Pré-visualização visual de uma badge (ícone + emoji + rótulo + cor),
 * espelhando o estilo dos badges renderizados no catálogo.
 */
import { cn } from '@/lib/utils';
import { colorClasses, resolveBadgeIcon, type BadgeDefinition } from './types';

interface BadgePreviewProps {
  badge: Pick<
    BadgeDefinition,
    'color_token' | 'icon_emoji' | 'icon_lucide' | 'is_enabled' | 'name' | 'short_label'
  >;
  compact?: boolean;
  className?: string;
}

export function BadgePreview({ badge, compact = false, className }: BadgePreviewProps) {
  const c = colorClasses(badge.color_token);
  const Icon = resolveBadgeIcon(badge.icon_lucide);
  const label = compact && badge.short_label ? badge.short_label : badge.name;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        c.bg,
        c.text,
        c.border,
        !badge.is_enabled && 'opacity-40 grayscale',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {badge.icon_emoji ? <span aria-hidden>{badge.icon_emoji}</span> : null}
      <span>{label}</span>
    </span>
  );
}

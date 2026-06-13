/**
 * Helper components and constants extracted from GlobalSearchPalette.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CommandItem } from '@/components/ui/command';
import { Trophy, Medal, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const paletteItemStateClass =
  'border border-transparent [background-color:transparent] transition-[background-color,border-color,color] data-[selected=true]:[background-color:hsl(var(--command-accent-strong))] data-[selected=true]:[border-color:hsl(var(--command-border-strong))] data-[selected=true]:text-foreground';

/**
 * Static map for type colors to avoid Tailwind JIT interpolation issues.
 * Tailwind purges classes like `${config.color}/10`.
 */
export const typeColorMap: Record<string, { bg: string; text: string; border: string }> = {
  product: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
  },
  quote: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20',
  },
  client: {
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    border: 'border-green-500/20',
  },
  collection: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-500',
    border: 'border-purple-500/20',
  },
  command: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/20',
  },
  default: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
  },
};

/* ── Rank badge with gradient ── */
export function RankBadge({ index }: { index: number }) {
  if (index === 0)
    return (
      <div className="flex h-10 w-10 shrink-0 animate-[brain-glow_3s_ease-in-out_infinite] items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary via-brand-primary/80 to-brand-primary/60 shadow-md shadow-brand-primary/15 ring-1 ring-brand-primary/10">
        <Trophy className="h-4 w-4 text-primary-foreground drop-shadow-sm" />
      </div>
    );
  if (index === 1)
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_hsl(var(--command-border))] [background-color:hsl(var(--command-surface-soft))] [border-color:hsl(var(--command-border-strong))]">
        <Medal className="h-4 w-4 [color:hsl(var(--command-text-muted))]" />
      </div>
    );
  if (index === 2)
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border [background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))]">
        <span className="text-xs font-bold [color:hsl(var(--command-text-muted))]">3º</span>
      </div>
    );
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border [background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))]">
      <span className="text-xs font-bold [color:hsl(var(--command-text-subtle))]">
        {index + 1}º
      </span>
    </div>
  );
}

/* ── Section Header — Carbon Sleek minimal ── */
export function SectionHeader({
  icon: _icon,
  label,
  count,
  gradient: _gradient,
  iconColor: _iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  gradient?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center px-4 pb-2 pt-4">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] [color:hsl(var(--command-text-subtle))]">
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <Badge
          variant="secondary"
          className="ml-auto h-[18px] rounded-md border-0 px-1.5 text-[10px] font-semibold [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]"
        >
          {count}
        </Badge>
      )}
    </div>
  );
}

/* ── CSS stagger animation style helper ── */
export function staggerStyle(index: number, baseDelay = 0): React.CSSProperties {
  return {
    animationDelay: `${baseDelay + index * 50}ms`,
    animationFillMode: 'backwards',
  };
}

/* ── Navigation Card for "Ir Para" ── */
export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  shortcut?: string;
  highlight?: boolean;
}

export function NavCard({
  action,
  index,
  onSelect,
}: {
  action: QuickAction;
  index: number;
  onSelect: (href: string) => void;
}) {
  const isHighlight = action.highlight;
  return (
    <CommandItem
      value={action.title}
      onSelect={() => onSelect(action.href)}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 duration-200 animate-in fade-in-0 slide-in-from-bottom-1 transition-all',
        paletteItemStateClass,
        '[background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))] hover:-translate-y-0.5 hover:[background-color:hsl(var(--command-surface-soft))] hover:[border-color:hsl(var(--command-border-strong))]',
      )}
      style={staggerStyle(index, 200)}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors',
          isHighlight
            ? 'bg-primary/12 text-primary'
            : '[background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))] group-hover:text-foreground',
        )}
      >
        <span className="[&>svg]:h-5 [&>svg]:w-5">{action.icon}</span>
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-foreground">
            {action.title}
          </span>
          {action.shortcut && (
            <kbd className="hidden h-[18px] min-w-[18px] items-center justify-center rounded border px-1 font-mono text-[10px] font-bold [background-color:hsl(var(--command-accent))] [border-color:hsl(var(--command-border-strong))] [color:hsl(var(--command-text-muted))] md:inline-flex">
              {action.shortcut}
            </kbd>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] [color:hsl(var(--command-text-subtle))]">
          {action.description}
        </p>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 [color:hsl(var(--command-text-subtle))]" />
    </CommandItem>
  );
}

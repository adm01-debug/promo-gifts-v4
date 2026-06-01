/**
 * Helper components extracted from GlobalSearchPalette.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CommandItem } from '@/components/ui/command';
import { Trophy, Medal, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const paletteItemStateClass =
  'border border-transparent [background-color:transparent] transition-[background-color,border-color,color] data-[selected=true]:[background-color:hsl(var(--command-accent-strong))] data-[selected=true]:[border-color:hsl(var(--command-border-strong))] data-[selected=true]:text-foreground';

/* ── Rank badge with gradient ── */
export function RankBadge({ index }: { index: number }) {
  if (index === 0)
    return (
      <div className="flex h-10 w-10 animate-[brain-glow_3s_ease-in-out_infinite] items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary via-brand-primary/80 to-brand-primary/60 shadow-lg shadow-brand-primary/25 ring-2 ring-brand-primary/20">
        <Trophy className="h-4.5 w-4.5 text-primary-foreground drop-shadow-sm" />
      </div>
    );
  if (index === 1)
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_hsl(var(--command-border)/0.4)] [background-color:hsl(var(--command-surface-soft))] [border-color:hsl(var(--command-border-strong))]">
        <Medal className="h-4 w-4 [color:hsl(var(--command-text-muted))]" />
      </div>
    );
  if (index === 2)
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border [background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))]">
        <span className="text-xs font-bold [color:hsl(var(--command-text-muted))]">3º</span>
      </div>
    );
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl border [background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))]">
      <span className="text-xs font-bold [color:hsl(var(--command-text-subtle))]">
        {index + 1}º
      </span>
    </div>
  );
}

/* ── Section Header — premium divider ── */
export function SectionHeader({
  icon,
  label,
  count,
  gradient,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  gradient?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 pb-2.5 pt-5">
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
          gradient || 'bg-primary/10',
        )}
      >
        <span className="text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      </div>
      <span className="font-display text-[11px] font-bold uppercase tracking-[0.1em] [color:hsl(var(--command-text-subtle))]">
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <Badge
          variant="secondary"
          className="h-4 rounded-full border-0 px-1.5 text-[9px] font-bold [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-subtle))]"
        >
          {count}
        </Badge>
      )}
      <div className="ml-1 h-px flex-1 [background:linear-gradient(90deg,hsl(var(--command-border-strong)),hsl(var(--command-border)),transparent)]" />
    </div>
  );
}

/* ── CSS stagger animation style helper ── */
export function staggerStyle(index: number, baseDelay = 0): React.CSSProperties {
  return {
    animationDelay: `${baseDelay + index * 50}ms`,
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
        'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 duration-200 animate-in fade-in-0 slide-in-from-bottom-1',
        paletteItemStateClass,
        isHighlight
          ? 'from-primary/12 via-primary/6 border border-primary/20 bg-gradient-to-r to-transparent'
          : '[background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))] hover:[background-color:hsl(var(--command-surface-soft))] hover:[border-color:hsl(var(--command-border-strong))]',
      )}
      style={staggerStyle(index, 200)}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
          isHighlight
            ? 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-sm shadow-primary/10'
            : '[background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]',
        )}
      >
        {action.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-[13px]',
            isHighlight ? 'font-semibold text-primary' : 'font-medium',
          )}
        >
          {action.title}
        </p>
        <p className="mt-0.5 truncate text-[10px] leading-tight [color:hsl(var(--command-text-subtle))]">
          {action.description}
        </p>
      </div>
      {action.shortcut && (
        <kbd className="hidden h-5 min-w-[22px] items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-1.5 font-mono text-[10px] font-semibold text-primary/60 md:inline-flex">
          {action.shortcut}
        </kbd>
      )}
      <ArrowUpRight
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          isHighlight ? 'text-primary/40' : '[color:hsl(var(--command-text-subtle))]',
        )}
      />
    </CommandItem>
  );
}

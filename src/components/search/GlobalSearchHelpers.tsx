/**
 * Helper components extracted from GlobalSearchPalette.
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  CommandItem,
} from "@/components/ui/command";
import { Trophy, Medal, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const paletteItemStateClass =
  "border border-transparent [background-color:transparent] transition-[background-color,border-color,color] data-[selected=true]:[background-color:hsl(var(--command-accent-strong))] data-[selected=true]:[border-color:hsl(var(--command-border-strong))] data-[selected=true]:text-foreground";

/* ── Rank badge with gradient ── */
export function RankBadge({ index }: { index: number }) {
  if (index === 0) return (
    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange via-orange/80 to-orange/60 flex items-center justify-center shadow-lg shadow-orange/25 animate-[brain-glow_3s_ease-in-out_infinite] ring-2 ring-orange/20">
      <Trophy className="h-4.5 w-4.5 text-primary-foreground drop-shadow-sm" />
    </div>
  );
  if (index === 1) return (
    <div className="h-10 w-10 rounded-xl [background-color:hsl(var(--command-surface-soft))] flex items-center justify-center border [border-color:hsl(var(--command-border-strong))] shadow-[inset_0_1px_0_hsl(var(--command-border)/0.4)]">
      <Medal className="h-4 w-4 [color:hsl(var(--command-text-muted))]" />
    </div>
  );
  if (index === 2) return (
    <div className="h-10 w-10 rounded-xl [background-color:hsl(var(--command-surface-raised))] flex items-center justify-center border [border-color:hsl(var(--command-border))]">
      <span className="text-xs font-bold [color:hsl(var(--command-text-muted))]">3º</span>
    </div>
  );
  return (
    <div className="h-10 w-10 rounded-xl [background-color:hsl(var(--command-surface-raised))] flex items-center justify-center border [border-color:hsl(var(--command-border))]">
      <span className="text-xs font-bold [color:hsl(var(--command-text-subtle))]">{index + 1}º</span>
    </div>
  );
}

/* ── Section Header — premium divider ── */
export function SectionHeader({ icon, label, count, gradient }: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  gradient?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-2.5">
      <div className={cn(
        "h-6 w-6 rounded-lg flex items-center justify-center shrink-0",
        gradient || "bg-primary/10"
      )}>
        <span className="text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      </div>
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] [color:hsl(var(--command-text-subtle))] font-display">{label}</span>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 rounded-full font-bold [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-subtle))] border-0">
          {count}
        </Badge>
      )}
      <div className="flex-1 h-px ml-1 [background:linear-gradient(90deg,hsl(var(--command-border-strong)),hsl(var(--command-border)),transparent)]" />
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

export function NavCard({ action, index, onSelect }: {
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
        "flex items-center gap-3 py-3 px-3 rounded-xl animate-in fade-in-0 slide-in-from-bottom-1 duration-200 cursor-pointer",
        paletteItemStateClass,
        isHighlight
          ? "bg-gradient-to-r from-primary/12 via-primary/6 to-transparent border border-primary/20"
          : "[background-color:hsl(var(--command-surface-raised))] hover:[background-color:hsl(var(--command-surface-soft))] [border-color:hsl(var(--command-border))] hover:[border-color:hsl(var(--command-border-strong))]"
      )}
      style={staggerStyle(index, 200)}
    >
      <div className={cn(
        "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
        isHighlight
          ? "bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-sm shadow-primary/10"
          : "[background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]"
      )}>
        {action.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[13px] truncate", isHighlight ? "font-semibold text-primary" : "font-medium")}>{action.title}</p>
        <p className="text-[10px] [color:hsl(var(--command-text-subtle))] truncate leading-tight mt-0.5">{action.description}</p>
      </div>
      {action.shortcut && (
        <kbd className="hidden md:inline-flex h-5 min-w-[22px] items-center justify-center rounded-md bg-primary/10 border border-primary/20 px-1.5 font-mono text-[10px] font-semibold text-primary/60">
          {action.shortcut}
        </kbd>
      )}
      <ArrowUpRight className={cn("h-3.5 w-3.5 shrink-0", isHighlight ? "text-primary/40" : "[color:hsl(var(--command-text-subtle))]")} />
    </CommandItem>
  );
}

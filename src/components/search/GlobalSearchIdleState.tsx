/**
 * GlobalSearchIdleState — Idle state sections extracted from GlobalSearchPalette
 * (Recent, Popular, Contextual Suggestions, Quick Actions)
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  Clock, Flame, X, Sparkles, Eye, Zap, Compass,
  Trophy, Medal, ChevronRight, ArrowUpRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ── Shared ── */
const paletteItemStateClass =
  "border border-transparent [background-color:transparent] transition-[background-color,border-color,color] data-[selected=true]:[background-color:hsl(var(--command-accent-strong))] data-[selected=true]:[border-color:hsl(var(--command-border-strong))] data-[selected=true]:text-foreground";

function staggerStyle(index: number, baseDelay = 0): React.CSSProperties {
  return { animationDelay: `${baseDelay + index * 50}ms` };
}

/* ── Section Header ── */
function SectionHeader({ icon, label, count, gradient }: {
  icon: React.ReactNode; label: string; count?: number; gradient?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-2.5">
      <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center shrink-0", gradient || "bg-primary/10")}>
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

/* ── Rank Badge ── */
function RankBadge({ index }: { index: number }) {
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

/* ── Quick Actions ── */
const quickActions = [
  { id: "new-quote", title: "Novo Orçamento", description: "Criar um novo orçamento", icon: <span className="h-4 w-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 18v-6"/><path d="M14 18v-3"/></svg></span>, href: "/orcamentos/novo", shortcut: "N", highlight: true },
  { id: "products", title: "Catálogo de Produtos", description: "Ver todos os produtos", icon: <span className="h-4 w-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></span>, href: "/" },
];

/* ── NavCard ── */
function NavCard({ action, index, onSelect }: {
  action: typeof quickActions[0]; index: number; onSelect: (href: string) => void;
}) {
  const isHighlight = 'highlight' in action && action.highlight;
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

/* ── Main Idle State Component ── */
interface GlobalSearchIdleStateProps {
  history: string[];
  popularProducts: Array<{ id: string; name: string; sku: string; view_count: number }>;
  contextualSuggestions: Array<{ id: string; text: string; icon: string; type: string }>;
  quickSuggestions: Array<{ label: string; icon: string }>;
  routeContext: { section: string };
  quickActionsData: Array<{ id: string; title: string; description: string; icon: React.ReactNode; href: string; shortcut?: string; highlight?: boolean }>;
  onSuggestionClick: (text: string) => void;
  onSelect: (href: string, addToHistory?: boolean) => void;
  onRemoveFromHistory: (e: React.MouseEvent, term: string) => void;
}

export function GlobalSearchIdleState({
  history, popularProducts, contextualSuggestions, quickSuggestions,
  routeContext, quickActionsData, onSuggestionClick, onSelect, onRemoveFromHistory,
}: GlobalSearchIdleStateProps) {
  return (
    <>
      {/* Recent */}
      {history.length > 0 && (
        <div className="animate-in fade-in-0 duration-200">
          <SectionHeader icon={<Clock />} label="Recentes" count={history.length} gradient="[background-color:hsl(var(--command-accent))]" />
          <div className="space-y-0.5 px-2">
            {history.slice(0, 4).map((term, i) => (
              <CommandItem
                key={`h-${i}`}
                value={`history-${term}`}
                onSelect={() => onSuggestionClick(term)}
                className={cn("flex items-center gap-3.5 py-2.5 rounded-xl px-3 group animate-in fade-in-0 slide-in-from-left-2 duration-200", paletteItemStateClass)}
                style={staggerStyle(i)}
              >
                <div className="h-9 w-9 rounded-xl [background-color:hsl(var(--command-accent))] flex items-center justify-center shrink-0 group-data-[selected=true]:[background-color:hsl(var(--command-accent-strong))]">
                  <Clock className="h-4 w-4 [color:hsl(var(--command-text-subtle))]" />
                </div>
                <span className="flex-1 text-[13px] truncate">{term}</span>
                <button
                  onClick={e => onRemoveFromHistory(e, term)}
                  aria-label={`Remover "${term}" do histórico`}
                  className="opacity-0 group-hover:opacity-100 group-data-[selected=true]:opacity-100 h-7 w-7 flex items-center justify-center hover:bg-destructive/10 rounded-lg transition-all"
                >
                  <X className="h-3 w-3 [color:hsl(var(--command-text-subtle))] hover:text-destructive" aria-hidden="true" />
                </button>
              </CommandItem>
            ))}
          </div>
        </div>
      )}

      {/* Popular Products */}
      {popularProducts.length > 0 && (
        <div className="animate-in fade-in-0 duration-300" style={{ animationDelay: '80ms' }}>
          <SectionHeader icon={<Flame />} label="Mais Populares" count={popularProducts.length} gradient="bg-gradient-to-br from-orange/15 to-orange/5" />
          <div className="space-y-1 px-2">
            {popularProducts.map((product, idx) => (
              <CommandItem
                key={`pop-${product.id}`}
                value={`popular-${product.name}`}
                onSelect={() => onSelect(`/produto/${product.id}`, false)}
                className={cn(
                  "flex items-center gap-3.5 py-3 rounded-xl px-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
                  paletteItemStateClass,
                  idx === 0 && "bg-gradient-to-r from-orange/[0.06] to-transparent border border-orange/10"
                )}
                style={staggerStyle(idx, 100)}
              >
                <RankBadge index={idx} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[13px] truncate", idx === 0 ? "font-bold" : "font-medium")}>{product.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] [color:hsl(var(--command-text-subtle))] font-mono [background-color:hsl(var(--command-accent))] px-1.5 py-0.5 rounded">{product.sku}</span>
                    <div className="flex items-center gap-1 text-[10px] [color:hsl(var(--command-text-subtle))]">
                      <Eye className="h-3 w-3" />
                      <span>{product.view_count}</span>
                    </div>
                  </div>
                </div>
                {idx === 0 ? (
                  <Badge className="shrink-0 text-[10px] h-6 rounded-lg bg-gradient-to-r from-orange/20 to-orange/10 text-orange border-orange/20 hover:bg-orange/25 font-semibold shadow-sm shadow-orange/10">
                    🔥 Top 1
                  </Badge>
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 [color:hsl(var(--command-text-subtle))]" />
                )}
              </CommandItem>
            ))}
          </div>
        </div>
      )}

      {/* Contextual Suggestions */}
      {contextualSuggestions.length > 0 && (
        <div className="animate-in fade-in-0 duration-300" style={{ animationDelay: '160ms' }}>
          <SectionHeader
            icon={<Sparkles />}
            label={routeContext.section === "products" ? "Para o Catálogo" : routeContext.section === "quotes" ? "Para Orçamentos" : "Sugestões"}
            gradient="bg-gradient-to-br from-primary/12 to-primary/4"
          />
          <div className="flex flex-wrap gap-2 px-4 pb-2" role="group" aria-label="Sugestões contextuais">
            {contextualSuggestions.slice(0, 6).map((sug, i) => (
              <motion.button
                key={sug.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15, delay: 0.2 + i * 0.04 }}
                onClick={() => onSuggestionClick(sug.text)}
                aria-label={`Buscar ${sug.text}`}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 shadow-sm",
                  sug.type === "filter" && "bg-gradient-to-r from-primary/8 to-primary/4 hover:from-primary/15 hover:to-primary/8 text-primary/80 hover:text-primary border border-primary/15 hover:border-primary/30",
                  sug.type === "navigation" && "[background-color:hsl(var(--command-surface-raised))] hover:[background-color:hsl(var(--command-surface-soft))] text-foreground border [border-color:hsl(var(--command-border))] hover:[border-color:hsl(var(--command-border-strong))]",
                  sug.type === "action" && "bg-gradient-to-r from-orange/8 to-orange/4 hover:from-orange/15 hover:to-orange/8 text-orange/80 hover:text-orange border border-orange/15 hover:border-orange/30",
                  sug.type === "search" && "[background-color:hsl(var(--command-surface-raised))] hover:[background-color:hsl(var(--command-surface-soft))] [color:hsl(var(--command-text-muted))] hover:text-foreground border [border-color:hsl(var(--command-border))] hover:[border-color:hsl(var(--command-border-strong))]",
                )}
              >
                <span className="text-sm leading-none">{sug.icon}</span>
                <span>{sug.text}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Shortcuts */}
      <div className="animate-in fade-in-0 duration-300" style={{ animationDelay: '240ms' }}>
        <SectionHeader icon={<Zap />} label="Atalhos" gradient="bg-gradient-to-br from-orange/12 to-orange/4" />
        <div className="flex flex-wrap gap-2 px-4 pb-2" role="group" aria-label="Atalhos rápidos">
          {quickSuggestions.map((qs, i) => (
            <motion.button
              key={`q-${i}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15, delay: 0.28 + i * 0.03 }}
              onClick={() => onSuggestionClick(qs.label)}
              aria-label={`Buscar ${qs.label}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 [background-color:hsl(var(--command-surface-raised))] hover:[background-color:hsl(var(--command-surface-soft))] rounded-xl text-xs font-medium [color:hsl(var(--command-text-muted))] hover:text-foreground transition-all duration-150 border [border-color:hsl(var(--command-border))] hover:[border-color:hsl(var(--command-border-strong))] hover:shadow-sm"
            >
              <span className="text-sm leading-none opacity-70">{qs.icon}</span>
              <span>{qs.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Go To — Navigation Grid */}
      <div className="pb-2 animate-in fade-in-0 duration-300" style={{ animationDelay: '320ms' }}>
        <SectionHeader icon={<Compass />} label="Ir Para" count={quickActionsData.length} gradient="bg-gradient-to-br from-primary/10 to-primary/4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 px-2">
          {quickActionsData.map((action, i) => (
            <NavCard key={action.id} action={action} index={i} onSelect={(href) => onSelect(href, false)} />
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * GlobalSearchPalette — High-contrast black redesign
 * Helper components extracted to GlobalSearchHelpers.tsx
 */
import React, { lazy, Suspense, useEffect, useCallback } from "react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Package, FileText, Loader2, Sparkles,
  Brain, Mic, Search, ChevronRight, Terminal,
  Sun, Moon, LogOut, PlusCircle, Users, Calculator, LifeBuoy,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useGlobalSearch } from "./useGlobalSearch";
import { typeConfig } from "./search-types";
import { GlobalSearchIdleState } from "./GlobalSearchIdleState";
import { paletteItemStateClass, NavCard, staggerStyle, type QuickAction } from "./GlobalSearchHelpers";
import { HighlightMatch } from "./HighlightMatch";
import { EmptySearchState } from "./EmptySearchState";

const LazyVoiceOverlay = lazy(() => import("./VoiceSearchOverlayConnected"));

/* ── Quick Actions ── */
const quickActions: QuickAction[] = [
  { id: "new-quote", title: "Novo Orçamento", description: "Criar um novo orçamento", icon: <FileText className="h-4 w-4" />, href: "/orcamentos/novo", shortcut: "N", highlight: true },
  { id: "products", title: "Catálogo de Produtos", description: "Ver todos os produtos", icon: <Package className="h-4 w-4" />, href: "/" },
  { id: "quotes", title: "Orçamentos", description: "Ver todos os orçamentos", icon: <FileText className="h-4 w-4" />, href: "/orcamentos" },
];
const commandIconMap: Record<string, any> = {
  Sun, Moon, LogOut, PlusCircle, Users, Calculator, LifeBuoy, Package, Terminal
};


export function GlobalSearchPalette() {
  const s = useGlobalSearch();

  // ── Power-user keyboard shortcuts ──
  // 1-9: jump to Nth result · Cmd/Ctrl+Enter: open in new tab
  useEffect(() => {
    if (!s.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        const first = s.results[0];
        if (first?.href) {
          e.preventDefault();
          window.open(first.href, "_blank", "noopener,noreferrer");
        }
        return;
      }
      if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        const idx = parseInt(e.key, 10) - 1;
        const result = s.results[idx];
        if (result) {
          e.preventDefault();
          s.handleSelect(result.href);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [s.open, s.results, s.handleSelect]);

  const handleEmptyAction = useCallback((href: string) => s.handleSelect(href), [s.handleSelect]);
  const handleEmptyRefine = useCallback(() => s.setQuery(""), [s.setQuery]);
  const handleEmptyPickRecent = useCallback((term: string) => s.setQuery(term), [s.setQuery]);

  return (
    <>
      {/* ── Trigger ── */}
      <div className="flex items-center gap-2 w-full md:w-auto">
        <button
          onClick={() => s.setOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-2.5 text-sm rounded-2xl border border-primary/20 hover:border-primary/40 bg-primary/5 backdrop-blur-md transition-all duration-300 flex-1 md:w-72 overflow-hidden shadow-[0_0_20px_rgba(var(--primary),0.05)]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/[0.05] to-primary/0 group-hover:via-primary/[0.1] transition-all duration-500 pointer-events-none" />
          <div className="relative h-6 w-6 rounded-lg bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center transition-colors duration-300 shrink-0">
            <Brain className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform duration-300" />
            <div className="absolute inset-0 rounded-lg bg-primary/20 animate-pulse pointer-events-none" />
          </div>
          <span className="relative flex-1 text-left text-primary/60 group-hover:text-primary transition-colors duration-300 text-[13px] font-medium tracking-wide">Busca galáctica...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border border-primary/20 bg-primary/5 text-[10px] font-bold text-primary/50 group-hover:border-primary/40 group-hover:text-primary transition-colors shrink-0 shadow-sm">⌘K</kbd>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={s.handleOpenVoiceOverlay} className="shrink-0 h-11 w-11 rounded-2xl border-primary/20 bg-primary/5 hover:bg-primary/15 hover:text-primary hover:border-primary/40 transition-all shadow-sm" aria-label="Microfone"><Mic className="h-4 w-4" /></Button>
          </TooltipTrigger>
          <TooltipContent className="bg-card border-border text-xs">Assistente de voz IA <kbd className="ml-1 text-[9px] opacity-60">Ctrl+Shift+V</kbd></TooltipContent>
        </Tooltip>
      </div>

      {/* ── Voice overlay ── */}
      {s.voiceOverlayOpen && (
        <Suspense fallback={null}>
          <LazyVoiceOverlay isOpen={s.voiceOverlayOpen} onClose={s.handleCloseVoiceOverlay} onAction={s.handleVoiceAction} />
        </Suspense>
      )}

      {/* ── Command Dialog ── */}
      <CommandDialog open={s.open} onOpenChange={s.setOpen}>
        <div className="relative">
          <CommandInput placeholder="Buscar produtos, orçamentos, clientes..." value={s.query} onValueChange={s.setQuery} />
          <div className="absolute bottom-0 left-6 right-6 h-[2px] rounded-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>

        <CommandList className="max-h-[520px] scrollbar-thin px-1 [background-color:hsl(var(--command-surface))]">
          {/* AI Processing Banner */}
          {s.isAIProcessing && (
            <div className="flex items-center gap-3 px-4 py-3.5 mx-2 mt-3 rounded-2xl bg-gradient-to-r from-primary/12 via-primary/6 to-primary/3 border border-primary/15 shadow-sm shadow-primary/5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center shadow-inner">
                <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary font-display">Analisando sua busca...</p>
                <p className="text-[11px] text-primary/50 mt-0.5">IA identificando intenção e filtros</p>
              </div>
              <Loader2 className="h-4 w-4 text-primary/40 animate-spin" />
            </div>
          )}

          {/* Intent chips */}
          {s.searchIntent && !s.isSearching && s.results.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 mx-2 mt-3 rounded-xl border [border-color:hsl(var(--command-border))] [background:linear-gradient(90deg,hsl(var(--command-surface-raised)),hsl(var(--command-surface)))] animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <div className="h-6 w-6 rounded-lg bg-primary/12 flex items-center justify-center"><Brain className="h-3.5 w-3.5 text-primary" /></div>
              <span className="text-[11px] font-semibold [color:hsl(var(--command-text-muted))]">Entendi:</span>
              {s.searchIntent.type !== "mixed" && typeConfig[s.searchIntent.type] && (
                <Badge variant="outline" className="text-[11px] h-5.5 rounded-lg font-semibold [border-color:hsl(var(--command-border-strong))] [background-color:hsl(var(--command-accent))]">
                  {typeConfig[s.searchIntent.type].label}s
                </Badge>
              )}
              {s.searchIntent.filters.category && <Badge variant="secondary" className="text-[11px] h-5.5 rounded-lg [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]">{s.searchIntent.filters.category}</Badge>}
              {s.searchIntent.filters.color && <Badge variant="secondary" className="text-[11px] h-5.5 rounded-lg [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]">Cor: {s.searchIntent.filters.color}</Badge>}
              {s.searchIntent.filters.priceRange && <Badge variant="secondary" className="text-[11px] h-5.5 rounded-lg [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]">{{ low: "Preço baixo", medium: "Preço médio", high: "Premium" }[s.searchIntent.filters.priceRange]}</Badge>}
              {s.searchIntent.filters.status && <Badge variant="secondary" className="text-[11px] h-5.5 rounded-lg [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]">Status: {s.searchIntent.filters.status}</Badge>}
              {s.searchIntent.filters.clientName && <Badge variant="secondary" className="text-[11px] h-5.5 rounded-lg [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]">Cliente: {s.searchIntent.filters.clientName}</Badge>}
            </div>
          )}

          {/* Loading state */}
          {s.isSearching && !s.isAIProcessing && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 animate-in fade-in-0 duration-300">
              <div className="relative">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shadow-lg shadow-primary/10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground/70">Buscando resultados...</p>
                <p className="text-[11px] text-muted-foreground/40 mt-1">Analisando catálogo com IA</p>
              </div>
            </div>
          )}

          {/* Empty state — intelligent */}
          {!s.isSearching && s.query.length >= 2 && s.results.length === 0 && (
            <EmptySearchState
              query={s.query}
              onAction={handleEmptyAction}
              onRefine={handleEmptyRefine}
              onPickRecent={handleEmptyPickRecent}
            />
          )}

          {/* Short query hint */}
          {!s.isSearching && s.query.length >= 1 && s.query.length < 3 && (
            <div className="flex items-center justify-center gap-2.5 px-4 py-8 animate-in fade-in-0 duration-200">
              <div className="h-7 w-7 rounded-lg [background-color:hsl(var(--command-accent))] flex items-center justify-center">
                <Search className="h-3.5 w-3.5 [color:hsl(var(--command-text-subtle))]" />
              </div>
              <span className="text-xs [color:hsl(var(--command-text-subtle))]">Continue digitando para buscar...</span>
            </div>
          )}

          {/* Search Results */}
          {!s.isSearching && Object.entries(s.groupedResults).map(([type, items]) => {
            const config = typeConfig[type];
            if (!config) return null;
            const BaseIcon = config.icon;

            return (
              <CommandGroup key={type} heading={config.label + "s"} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:pb-2">
                {items.map((result, i) => (
                  <CommandItem
                    key={result.id}
                    value={result.title}
                    onSelect={() => s.handleSelect(result.href)}
                    className={cn("flex items-center gap-3.5 py-3 rounded-xl mx-2 px-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-200", paletteItemStateClass)}
                    style={staggerStyle(i, 50)}
                  >
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", `${config.color}/10`)}>
                      {type === "command" && result.metadata?.iconName ? (
                        (() => {
                          const CmdIcon = commandIconMap[result.metadata.iconName as string] || Terminal;
                          return <CmdIcon className={cn("h-4.5 w-4.5", config.color.replace("bg-", "text-"))} />;
                        })()
                      ) : (
                        <BaseIcon className={cn("h-4.5 w-4.5", config.color.replace("bg-", "text-"))} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-[13px]">
                        <HighlightMatch text={result.title} query={s.query} />
                      </p>
                      {result.subtitle && (
                        <p className="text-[11px] [color:hsl(var(--command-text-muted))] truncate mt-0.5">
                          <HighlightMatch text={result.subtitle} query={s.query} highlightClassName="bg-primary/15 text-primary font-semibold rounded-sm px-0.5" />
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] h-5 rounded-lg [border-color:hsl(var(--command-border-strong))] [background-color:hsl(var(--command-accent))] font-medium">{config.label}</Badge>
                    <ChevronRight className="h-3.5 w-3.5 [color:hsl(var(--command-text-subtle))]" />
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}

          {/* Typing suggestions */}
          {s.typingSuggestions.length > 0 && s.query.length >= 2 && s.query.length < 5 && !s.isSearching && (
            <CommandGroup heading="Sugestões" className="animate-in fade-in-0 duration-200">
              {s.typingSuggestions.map((suggestion, i) => (
                <CommandItem
                  key={`sug-${i}`}
                  value={`suggestion-${suggestion}`}
                  onSelect={() => s.handleSuggestionClick(suggestion)}
                  className={cn("flex items-center gap-3.5 py-3 rounded-xl mx-2 px-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-200", paletteItemStateClass)}
                  style={staggerStyle(i)}
                >
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/12 to-primary/4 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary/70" />
                  </div>
                  <span className="flex-1 text-[13px] font-medium">{suggestion}</span>
                  <ChevronRight className="h-3.5 w-3.5 [color:hsl(var(--command-text-subtle))]" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* IDLE STATE */}
          {s.query.length < 2 && !s.isSearching && (
            <GlobalSearchIdleState
              history={s.history}
              popularProducts={s.popularProducts}
              contextualSuggestions={s.contextualSuggestions}
              quickSuggestions={s.quickSuggestions}
              routeContext={s.routeContext}
              quickActionsData={quickActions}
              onSuggestionClick={s.handleSuggestionClick}
              onSelect={s.handleSelect}
              onRemoveFromHistory={s.handleRemoveFromHistory}
            />
          )}
        </CommandList>

        {/* Premium Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t [border-color:hsl(var(--command-border))] [background:linear-gradient(90deg,hsl(var(--command-surface-raised)),hsl(var(--command-surface)),hsl(var(--command-surface-raised)))] select-none">
          <div className="flex items-center gap-4 text-[11px] [color:hsl(var(--command-text-subtle))]">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center h-[18px] min-w-[20px] rounded-md [background-color:hsl(var(--command-accent))] border [border-color:hsl(var(--command-border))] font-mono text-[10px] leading-none px-1">↵</kbd>
              <span>Selecionar</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center h-[18px] min-w-[20px] rounded-md [background-color:hsl(var(--command-accent))] border [border-color:hsl(var(--command-border))] font-mono text-[10px] leading-none px-1">↑↓</kbd>
              <span>Navegar</span>
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center h-[18px] min-w-[20px] rounded-md [background-color:hsl(var(--command-accent))] border [border-color:hsl(var(--command-border))] font-mono text-[10px] leading-none px-1">1-9</kbd>
              <span>Saltar</span>
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center h-[18px] rounded-md [background-color:hsl(var(--command-accent))] border [border-color:hsl(var(--command-border))] font-mono text-[10px] leading-none px-1">⌘↵</kbd>
              <span>Nova aba</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center h-[18px] min-w-[20px] rounded-md [background-color:hsl(var(--command-accent))] border [border-color:hsl(var(--command-border))] font-mono text-[10px] leading-none px-1">ESC</kbd>
              <span>Fechar</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-primary/40 font-medium">
            <div className="h-4 w-4 rounded-md bg-primary/8 flex items-center justify-center"><Brain className="h-2.5 w-2.5" /></div>
            <span>Busca com IA</span>
          </div>
        </div>
      </CommandDialog>
    </>
  );
}

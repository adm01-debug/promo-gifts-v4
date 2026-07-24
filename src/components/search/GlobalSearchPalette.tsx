/**
 * GlobalSearchPalette — High-contrast black redesign
 * Helper components extracted to GlobalSearchHelpers.tsx
 */
import { lazy, Suspense, useEffect, useCallback } from 'react';
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Package,
  FileText,
  Loader2,
  Sparkles,
  Brain,
  Mic,
  Search,
  ChevronRight,
  Terminal,
  Sun,
  Moon,
  LogOut,
  PlusCircle,
  Users,
  Calculator,
  LifeBuoy,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useGlobalSearch } from './useGlobalSearch';
import { typeConfig } from './search-types';
import { GlobalSearchIdleState } from './GlobalSearchIdleState';
import {
  paletteItemStateClass,
  staggerStyle,
  type QuickAction,
  typeColorMap,
} from './GlobalSearchHelpers';
import { HighlightMatch } from './HighlightMatch';
import { EmptySearchState } from './EmptySearchState';

const LazyVoiceOverlay = lazy(() => import('./VoiceSearchOverlayConnected'));

/* ── Quick Actions ── */
const quickActions: QuickAction[] = [
  {
    id: 'new-quote',
    title: 'Novo Orçamento',
    description: 'Criar um novo orçamento',
    icon: <FileText className="h-4 w-4" />,
    href: '/orcamentos/novo',
    shortcut: 'N',
    highlight: true,
  },
  {
    id: 'products',
    title: 'Catálogo de Produtos',
    description: 'Ver todos os produtos',
    icon: <Package className="h-4 w-4" />,
    href: '/',
  },
  {
    id: 'quotes',
    title: 'Orçamentos',
    description: 'Ver todos os orçamentos',
    icon: <FileText className="h-4 w-4" />,
    href: '/orcamentos',
  },
];

const commandIconMap: Record<string, LucideIcon> = {
  Sun,
  Moon,
  LogOut,
  PlusCircle,
  Users,
  Calculator,
  LifeBuoy,
  Package,
  Terminal,
};

export function GlobalSearchPalette() {
  const s = useGlobalSearch();

  // ── Power-user keyboard shortcuts ──
  useEffect(() => {
    if (!s.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        const first = s.results[0];
        if (first?.href) {
          e.preventDefault();
          window.open(first.href, '_blank', 'noopener,noreferrer');
        }
        return;
      }
      if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        const idx = parseInt(e.key, 10) - 1;
        const result = s.results[idx];
        if (result) {
          e.preventDefault();
          s.handleSelect(result.href);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.open, s.results, s.handleSelect]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleEmptyAction = useCallback((href: string) => s.handleSelect(href), [s.handleSelect]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleEmptyRefine = useCallback(() => s.setQuery(''), [s.setQuery]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleEmptyPickRecent = useCallback((term: string) => s.setQuery(term), [s.setQuery]);

  // Guards defensivos
  const safeHistory = s.history ?? [];
  const safePopularProducts = (s.popularProducts ?? []) as Array<{
    id: string;
    name: string;
    sku: string;
    view_count: number;
    image_url?: string;
    category_name?: string;
  }>;
  const safeContextualSuggestions = s.contextualSuggestions ?? [];
  const safeQuickSuggestions = s.quickSuggestions ?? [];
  const safeRouteContext = s.routeContext ?? { section: '' };
  const safeGroupedResults = s.groupedResults ?? {};
  const safeTypingSuggestions = s.typingSuggestions ?? [];

  return (
    <>
      {/* ── Trigger ── */}
      <div className="flex w-full items-center gap-2 md:w-auto">
        <button
          onClick={() => s.setOpen(true)}
          aria-label="Abrir busca global"
          aria-haspopup="dialog"
          className="group relative flex flex-1 items-center gap-3 overflow-hidden rounded-2xl border border-border/40 bg-muted/40 px-4 py-[9px] text-sm shadow-sm backdrop-blur-md transition-all duration-300 hover:border-primary/40 md:w-full"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/[0.05] to-primary/0 transition-all duration-500 group-hover:via-primary/[0.1]" />
          <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors duration-300 group-hover:bg-primary/20">
            <Search className="h-3.5 w-3.5 text-muted-foreground transition-all duration-300 group-hover:scale-110 group-hover:text-primary" />
          </div>
          <span className="relative flex-1 text-left text-[13px] font-medium tracking-wide text-muted-foreground/60 transition-colors duration-300 group-hover:text-foreground">
            Busque por produtos, orçamentos ou clientes...
          </span>
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-border/40 bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground shadow-sm transition-colors group-hover:border-primary/40 group-hover:text-primary sm:inline-flex">
            ⌘K
          </kbd>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={s.handleOpenVoiceOverlay}
              className="h-11 w-11 shrink-0 rounded-2xl border-primary/20 bg-primary/5 shadow-sm transition-all hover:border-primary/40 hover:bg-primary/15 hover:text-primary"
              aria-label="Fale com o Flow"
            >
              <Mic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Fale com o Flow <kbd className="ml-1 text-[9px] opacity-60">Ctrl+Shift+V</kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* ── Voice overlay ── */}
      {s.voiceOverlayOpen && (
        <Suspense fallback={null}>
          <LazyVoiceOverlay
            isOpen={s.voiceOverlayOpen}
            onClose={s.handleCloseVoiceOverlay}
            onAction={s.handleVoiceAction}
          />
        </Suspense>
      )}

      {/* ── Command Dialog ── */}
      <CommandDialog
        open={s.open}
        onOpenChange={s.setOpen}
        dialogTitle="Busca global"
        contentClassName="top-[12%] max-w-[426px] translate-y-0 border border-[hsl(var(--command-border))] !rounded-xl bg-[hsl(var(--command-surface))] shadow-[0_36px_120px_hsl(var(--command-shadow)),0_0_0_1px_hsl(var(--command-border-strong))] data-[state=open]:slide-in-from-top-6 data-[state=closed]:slide-out-to-top-6"
      >
        <div className="relative border-b [border-color:hsl(var(--command-border))]">
          <CommandInput
            placeholder="Buscar produtos, orçamentos ou clientes..."
            value={s.query}
            onValueChange={s.setQuery}
            className="h-14 text-[15px] font-medium placeholder:[color:hsl(var(--command-text-subtle))]"
          />
          <div className="absolute bottom-0 left-5 right-5 h-px bg-primary/40" />
        </div>

        <CommandList className="scrollbar-thin max-h-[560px] px-2 py-2 [background-color:hsl(var(--command-surface))]">
          {/* Search error banner */}
          {s.searchError && !s.isSearching && (
            <div className="mx-2 mt-3 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 duration-300 animate-in fade-in-0 slide-in-from-top-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive/70" />
              <p className="text-xs text-destructive/80">
                Erro ao buscar. Verifique sua conexão e tente novamente.
              </p>
            </div>
          )}

          {/* AI Processing Banner */}
          {s.isAIProcessing && (
            <div className="from-primary/12 via-primary/6 to-primary/3 mx-2 mt-3 flex items-center gap-3 rounded-2xl border border-primary/15 bg-gradient-to-r px-4 py-3.5 shadow-sm shadow-primary/5 duration-300 animate-in fade-in-0 slide-in-from-top-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 shadow-inner">
                <Sparkles className="h-4 w-4 animate-pulse text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-display text-sm font-semibold text-primary">
                  Analisando sua busca...
                </p>
                <p className="mt-0.5 text-[11px] text-primary/50">
                  IA identificando intenção e filtros
                </p>
              </div>
              <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
            </div>
          )}

          {/* Intent chips */}
          {s.searchIntent && !s.isSearching && s.results.length > 0 && (
            <div className="mx-2 mt-3 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 duration-200 animate-in fade-in-0 slide-in-from-top-1 [background:linear-gradient(90deg,hsl(var(--command-surface-raised)),hsl(var(--command-surface)))] [border-color:hsl(var(--command-border))]">
              <div className="bg-primary/12 flex h-6 w-6 items-center justify-center rounded-lg">
                <Brain className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[11px] font-semibold [color:hsl(var(--command-text-muted))]">
                Entendi:
              </span>
              {s.searchIntent.type !== 'mixed' && typeConfig[s.searchIntent.type] && (
                <Badge
                  variant="outline"
                  className="h-5 rounded-lg text-[11px] font-semibold [background-color:hsl(var(--command-accent))] [border-color:hsl(var(--command-border-strong))]"
                >
                  {typeConfig[s.searchIntent.type].label}s
                </Badge>
              )}
              {s.searchIntent.filters.category && (
                <Badge
                  variant="secondary"
                  className="h-5 rounded-lg text-[11px] [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]"
                >
                  {s.searchIntent.filters.category}
                </Badge>
              )}
              {s.searchIntent.filters.color && (
                <Badge
                  variant="secondary"
                  className="h-5 rounded-lg text-[11px] [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]"
                >
                  Cor: {s.searchIntent.filters.color}
                </Badge>
              )}
              {s.searchIntent.filters.priceRange && (
                <Badge
                  variant="secondary"
                  className="h-5 rounded-lg text-[11px] [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]"
                >
                  {
                    { low: 'Preço baixo', medium: 'Preço médio', high: 'Premium' }[
                      s.searchIntent.filters.priceRange
                    ]
                  }
                </Badge>
              )}
              {s.searchIntent.filters.status && (
                <Badge
                  variant="secondary"
                  className="h-5 rounded-lg text-[11px] [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]"
                >
                  Status: {s.searchIntent.filters.status}
                </Badge>
              )}
              {s.searchIntent.filters.clientName && (
                <Badge
                  variant="secondary"
                  className="h-5 rounded-lg text-[11px] [background-color:hsl(var(--command-accent))] [color:hsl(var(--command-text-muted))]"
                >
                  Cliente: {s.searchIntent.filters.clientName}
                </Badge>
              )}
            </div>
          )}

          {/* Loading state */}
          {s.isSearching && !s.isAIProcessing && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 duration-300 animate-in fade-in-0">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 shadow-lg shadow-primary/10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
                </div>
                <div className="absolute inset-0 animate-ping rounded-2xl bg-primary/10 opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground/70">
                  Buscando resultados...
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/40">
                  Analisando catálogo com IA
                </p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!s.isSearching && s.query.length >= 3 && s.results.length === 0 && (
            <EmptySearchState
              query={s.query}
              onAction={handleEmptyAction}
              onRefine={handleEmptyRefine}
              onPickRecent={handleEmptyPickRecent}
            />
          )}

          {/* Short query hint */}
          {!s.isSearching && s.query.length >= 1 && s.query.length < 3 && (
            <div className="flex items-center justify-center gap-2.5 px-4 py-8 duration-200 animate-in fade-in-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg [background-color:hsl(var(--command-accent))]">
                <Search className="h-3.5 w-3.5 [color:hsl(var(--command-text-subtle))]" />
              </div>
              <span className="text-xs [color:hsl(var(--command-text-subtle))]">
                Continue digitando para buscar...
              </span>
            </div>
          )}

          {/* Search Results */}
          {!s.isSearching &&
            Object.entries(safeGroupedResults).map(([type, items]) => {
              const config = typeConfig[type];
              if (!config) return null;
              const BaseIcon = config.icon;
              const typeColors = typeColorMap[type] || typeColorMap.default;

              return (
                <CommandGroup
                  key={type}
                  heading={`${config.label}s`}
                  className="duration-300 animate-in fade-in-0 slide-in-from-bottom-2 [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-4"
                >
                  {(items ?? []).map((result, i) => (
                    <CommandItem
                      key={result.id}
                      value={`${type}-${result.id}-${result.title}`}
                      onSelect={() => s.handleSelect(result.href)}
                      className={cn(
                        'mx-2 flex items-center gap-3.5 rounded-xl px-3 py-3 duration-200 animate-in fade-in-0 slide-in-from-bottom-1',
                        paletteItemStateClass,
                      )}
                      style={staggerStyle(i, 50)}
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm',
                          typeColors.bg,
                        )}
                      >
                        {type === 'command' && result.metadata?.iconName ? (
                          (() => {
                            const CmdIcon =
                              commandIconMap[result.metadata.iconName as string] || Terminal;
                            return <CmdIcon className={cn('h-4 w-4', typeColors.text)} />;
                          })()
                        ) : (
                          <BaseIcon className={cn('h-4 w-4', typeColors.text)} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">
                          <HighlightMatch text={result.title} query={s.query} />
                        </p>
                        {result.subtitle && (
                          <p className="mt-0.5 truncate text-[11px] [color:hsl(var(--command-text-muted))]">
                            <HighlightMatch
                              text={result.subtitle}
                              query={s.query}
                              highlightClassName="bg-primary/15 text-primary font-semibold rounded-sm px-0.5"
                            />
                          </p>
                        )}
                      </div>

                      {/* Power-user indicator for first 9 results */}
                      {i < 9 && !s.query.trim() && (
                        <kbd className="hidden h-5 w-5 items-center justify-center rounded border border-border bg-muted/30 text-[10px] font-bold text-muted-foreground sm:flex">
                          {i + 1}
                        </kbd>
                      )}

                      <Badge
                        variant="outline"
                        className="h-5 shrink-0 rounded-lg text-[10px] font-medium [background-color:hsl(var(--command-accent))] [border-color:hsl(var(--command-border-strong))]"
                      >
                        {config.label}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 [color:hsl(var(--command-text-subtle))]" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}

          {/* Typing suggestions */}
          {safeTypingSuggestions.length > 0 &&
            s.query.length >= 2 &&
            s.query.length < 5 &&
            !s.isSearching && (
              <CommandGroup heading="Sugestões" className="duration-200 animate-in fade-in-0">
                {safeTypingSuggestions.map((suggestion, i) => (
                  <CommandItem
                    key={`sug-${i}`}
                    value={`suggestion-${suggestion}`}
                    onSelect={() => s.handleSuggestionClick(suggestion)}
                    className={cn(
                      'mx-2 flex items-center gap-3.5 rounded-xl px-3 py-3 duration-200 animate-in fade-in-0 slide-in-from-bottom-1',
                      paletteItemStateClass,
                    )}
                    style={staggerStyle(i)}
                  >
                    <div className="from-primary/12 to-primary/4 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br">
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
              history={safeHistory}
              popularProducts={safePopularProducts}
              contextualSuggestions={safeContextualSuggestions}
              quickSuggestions={safeQuickSuggestions}
              routeContext={safeRouteContext}
              quickActionsData={quickActions}
              onSuggestionClick={s.handleSuggestionClick}
              onSelect={s.handleSelect}
              onRemoveFromHistory={s.handleRemoveFromHistory}
            />
          )}
        </CommandList>

        {/* Premium Footer — Carbon Sleek keycaps */}
        <div className="flex select-none items-center gap-5 border-t px-5 py-3 [background-color:hsl(var(--command-surface-raised))] [border-color:hsl(var(--command-border))]">
          <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2 text-[11px] [color:hsl(var(--command-text-subtle))]">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded border border-b-2 px-1 font-mono text-[10px] font-medium leading-none text-foreground [background-color:hsl(var(--command-accent))] [border-bottom-color:hsl(var(--command-border-strong))] [border-color:hsl(var(--command-border))]">
                ↵
              </kbd>
              <span>Selecionar</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded border border-b-2 px-1 font-mono text-[10px] font-medium leading-none text-foreground [background-color:hsl(var(--command-accent))] [border-bottom-color:hsl(var(--command-border-strong))] [border-color:hsl(var(--command-border))]">
                ↑↓
              </kbd>
              <span>Navegar</span>
            </span>
            <span className="hidden items-center gap-1.5 md:inline-flex">
              <kbd className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded border border-b-2 px-1 font-mono text-[10px] font-medium leading-none text-foreground [background-color:hsl(var(--command-accent))] [border-bottom-color:hsl(var(--command-border-strong))] [border-color:hsl(var(--command-border))]">
                1-9
              </kbd>
              <span>Saltar</span>
            </span>
            <span className="hidden items-center gap-1.5 md:inline-flex">
              <kbd className="inline-flex h-[18px] items-center justify-center rounded border border-b-2 px-1 font-mono text-[10px] font-medium leading-none text-foreground [background-color:hsl(var(--command-accent))] [border-bottom-color:hsl(var(--command-border-strong))] [border-color:hsl(var(--command-border))]">
                ⌘↵
              </kbd>
              <span>Nova aba</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded border border-b-2 px-1 font-mono text-[10px] font-medium leading-none text-foreground [background-color:hsl(var(--command-accent))] [border-bottom-color:hsl(var(--command-border-strong))] [border-color:hsl(var(--command-border))]">
                ESC
              </kbd>
              <span>Fechar</span>
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex cursor-help items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary/80 transition-colors hover:bg-primary/15">
                <Sparkles className="h-2.5 w-2.5" />
                <span>Busca com IA</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-center text-xs">
              Usa IA para entender intenções de busca, cores, categorias e filtros automáticos.
            </TooltipContent>
          </Tooltip>
        </div>
      </CommandDialog>
    </>
  );
}

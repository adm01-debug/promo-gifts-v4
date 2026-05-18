import { useRef, useEffect, useState } from "react";
import { SmartSearchInput } from "@/components/search";
import { RecentlyViewedPopover } from "@/components/products/RecentlyViewedPopover";
import { Home, Search, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AnimatePresence } from "framer-motion";

interface CatalogHeaderProps {
  shouldShowCatalogSkeleton: boolean;
  totalEstimate: number | null;
  filteredCount: number;
  hasNextPage: boolean | undefined;
  onSelect: (result: { type: string; id: string; label: string }) => void;
  searchQuery?: string;
  onReset?: () => void;
  activeFiltersCount?: number;
  searchHistory?: string[];
  onClearHistory?: () => void;
}

export function CatalogHeader({
  shouldShowCatalogSkeleton,
  totalEstimate,
  filteredCount,
  hasNextPage,
  onSelect,
  searchQuery = "",
  onReset,
  activeFiltersCount = 0,
  searchHistory = [],
  onClearHistory,
}: CatalogHeaderProps) {
  const hasActiveConstraints = searchQuery.trim().length > 0 || activeFiltersCount > 0;
  const searchRef = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);


  // "/" shortcut to focus search (standard pattern: Notion, GitHub, Figma)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        const input = searchRef.current?.querySelector("input");
        input?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Reset / Home button — visible when search or filters are active */}
        {hasActiveConstraints && onReset && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onReset}
                className="shrink-0 h-9 w-9 border-primary/40 text-primary hover:bg-primary/10"
                aria-label="Voltar ao início"
              >
                <Home className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Voltar ao catálogo completo</TooltipContent>
          </Tooltip>
        )}

        <h1 
          data-testid="page-title-produtos"
          className="font-display text-xl sm:text-2xl lg:text-3xl font-bold whitespace-nowrap"
        >
          Catálogo de Produtos
          <span className="text-muted-foreground font-normal text-sm sm:text-base ml-2">
            · {shouldShowCatalogSkeleton
              ? "Carregando catálogo..."
              : hasActiveConstraints
                ? <>
                    <span className="text-primary font-semibold">{filteredCount.toLocaleString("pt-BR")}</span>
                    {totalEstimate ? ` de ${totalEstimate.toLocaleString("pt-BR")}` : ""} itens
                  </>
                : totalEstimate
                  ? `${totalEstimate.toLocaleString("pt-BR")} itens`
                  : `${filteredCount.toLocaleString("pt-BR")} itens`
            }
          </span>
        </h1>

        {/* Search inline next to product count on desktop */}
        <div className="hidden sm:flex items-center gap-2 w-80 lg:w-[28rem]" ref={searchRef}>
          <SmartSearchInput
            placeholder="Buscar produtos…  /"
            onSelect={onSelect}
            className="flex-1"
          />
          
          <AnimatePresence>
            {searchHistory.length > 0 && (
              <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-lg border-muted-foreground/20 hover:border-primary/50 relative group overflow-hidden" aria-label="Histórico de buscas recentes">
                          <Clock className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-primary text-[8px] flex items-center justify-center border-2 border-background">
                            {searchHistory.length}
                          </Badge>
                        </Button>
                      </PopoverTrigger>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Histórico de buscas recentes ({searchHistory.length})</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-64 p-2" align="end">
                  <div className="flex items-center justify-between px-2 pb-2 border-b border-border/50 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Histórico</span>
                    <Button variant="ghost" size="xs" onClick={onClearHistory} className="h-6 text-[10px] text-muted-foreground hover:text-destructive gap-1 px-1.5">
                      <Trash2 className="h-3 w-3" /> Limpar
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                    {searchHistory.map((term, i) => (
                      <button
                        key={i}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left group transition-colors"
                        onClick={() => {
                          onSelect({ type: 'history', id: `hist-${i}`, label: term });
                          setHistoryOpen(false);
                        }}
                      >
                        <Search className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                        <span className="truncate flex-1">{term}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden sm:block">
          <RecentlyViewedPopover maxVisible={10} />
        </div>
      </div>

      {/* Search full-width on mobile */}
      <div className="flex items-center gap-2 w-full sm:hidden">
        <SmartSearchInput
          placeholder="Buscar produtos..."
          onSelect={onSelect}
          className="flex-1"
        />
        {searchHistory.length > 0 && (
          <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setHistoryOpen(!historyOpen)}>
            <Clock className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
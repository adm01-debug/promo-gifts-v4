import { useRef, useEffect, useState, memo } from 'react';
import { SmartSearchInput } from '@/components/search';
import { RecentlyViewedPopover } from '@/components/products/RecentlyViewedPopover';
import { Search, Clock, Trash2, LayoutGrid, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNavigate } from 'react-router-dom';
import { useNavigationAnalytics } from '@/hooks/useNavigationAnalytics';

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
  // Prop to render toolbar
  toolbar?: React.ReactNode;
}

export const CatalogHeader = memo(function CatalogHeader({
  shouldShowCatalogSkeleton,
  totalEstimate,
  filteredCount,
  hasNextPage: _hasNextPage,
  onSelect,
  searchQuery = '',
  activeFiltersCount = 0,
  searchHistory = [],
  onClearHistory,
  toolbar,
}: CatalogHeaderProps) {
  const navigate = useNavigate();
  const { trackNavigationClick } = useNavigationAnalytics();
  const hasActiveConstraints = searchQuery.trim().length > 0 || activeFiltersCount > 0;

  const handleTeleport = () => {
    trackNavigationClick('Teletransporte', '/');
    if (onReset) onReset();
    navigate('/', { replace: true });
  };

  const searchRef = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // "/" shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
          return;
        e.preventDefault();
        const input = searchRef.current?.querySelector('input');
        input?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <h1
                data-testid="page-title-produtos"
                className="whitespace-nowrap font-display text-2xl font-bold sm:text-3xl lg:text-4xl"
              >
                Catálogo de Produtos
              </h1>
              {hasActiveConstraints && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleTeleport}
                        className="group flex h-6 items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/5 px-2.5 text-[10px] font-bold text-sky-400 transition-all hover:bg-sky-400/10 active:scale-95 sm:h-7 sm:px-3 sm:text-xs"
                      >
                        <Zap className="h-3 w-3 animate-pulse text-sky-400" />
                        <span>Teletransporte</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      Limpar tudo e voltar ao início do catálogo
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          <div className="flex max-w-[48rem] flex-1 items-center gap-2" ref={searchRef}>
            <div className="relative flex-1">
              <SmartSearchInput
                inputId="search-catalog"
                placeholder="Buscar produtos...  /"
                onSelect={onSelect}
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50">
                    {shouldShowCatalogSkeleton ? (
                      <span className="animate-pulse">Carregando...</span>
                    ) : (
                      <>
                        <span className="font-bold text-foreground">
                          {filteredCount.toLocaleString('pt-BR')}
                        </span>
                        {totalEstimate && hasActiveConstraints && (
                          <span className="ml-1 opacity-70">
                            de {totalEstimate.toLocaleString('pt-BR')}
                          </span>
                        )}
                        <span className="ml-1">itens</span>
                      </>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total de itens encontrados</TooltipContent>
              </Tooltip>

              {searchHistory.length > 0 && (
                <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="group relative h-11 w-11 shrink-0 rounded-lg border-muted-foreground/20 hover:border-primary/50"
                            aria-label="Histórico de buscas recentes"
                          >
                            <Clock className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                            <Badge className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary p-0 text-[10px] font-bold text-primary-foreground shadow-sm">
                              {searchHistory.length}
                            </Badge>
                          </Button>
                        </PopoverTrigger>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Histórico de buscas recentes ({searchHistory.length})
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent className="w-64 p-2" align="end">
                    <div className="mb-2 flex items-center justify-between border-b border-border/50 px-2 pb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Histórico
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearHistory}
                        className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" /> Limpar
                      </Button>
                    </div>
                    <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
                      {searchHistory.map((term, i) => (
                        <button
                          key={term}
                          className="group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                          onClick={() => {
                            onSelect({ type: 'history', id: `hist-${i}`, label: term });
                            setHistoryOpen(false);
                          }}
                        >
                          <Search className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                          <span className="flex-1 truncate">{term}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <RecentlyViewedPopover maxVisible={10} />
            </div>
          </div>
        </div>

        {toolbar && (
          <div className="duration-300 animate-in fade-in slide-in-from-top-2">{toolbar}</div>
        )}
      </div>
    </div>
  );
});

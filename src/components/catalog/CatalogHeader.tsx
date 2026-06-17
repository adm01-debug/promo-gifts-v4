import { useRef, useEffect, useState, memo } from 'react';
import { SmartSearchInput } from '@/components/search';
import { RecentlyViewedPopover } from '@/components/products/RecentlyViewedPopover';
import { Home, Search, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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

function CatalogHeaderInner({
  shouldShowCatalogSkeleton,
  totalEstimate,
  filteredCount,
  hasNextPage: _hasNextPage,
  onSelect,
  searchQuery = '',
  onReset,
  activeFiltersCount = 0,
  searchHistory = [],
  onClearHistory,
}: CatalogHeaderProps) {
  const hasActiveConstraints = searchQuery.trim() !== '' || activeFiltersCount > 0;
  const searchRef = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasHistory = searchHistory.length > 0;

  // "/" shortcut to focus search (standard pattern: Notion, GitHub, Figma)
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Reset / Home button — visible when search or filters are active */}
        {hasActiveConstraints && onReset && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onReset}
                className="h-9 w-9 shrink-0 border-primary/40 text-primary hover:bg-primary/10"
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
          className="whitespace-nowrap font-display text-xl font-bold sm:text-2xl lg:text-3xl"
        >
          Catálogo de Produtos
          <span className="ml-2 text-sm font-normal text-muted-foreground sm:text-base">
            ·{' '}
            {shouldShowCatalogSkeleton ? (
              'Carregando catálogo...'
            ) : hasActiveConstraints ? (
              <>
                <span className="font-semibold tabular-nums text-primary">
                  {filteredCount.toLocaleString('pt-BR')}
                </span>
                <span className="tabular-nums">
                  {totalEstimate ? ` de ${totalEstimate.toLocaleString('pt-BR')}` : ''} itens
                </span>
              </>
            ) : totalEstimate ? (
              <span className="tabular-nums">{`${totalEstimate.toLocaleString('pt-BR')} itens`}</span>
            ) : (
              <span className="tabular-nums">{`${filteredCount.toLocaleString('pt-BR')} itens`}</span>
            )}
          </span>
        </h1>

        {/* Search inline next to product count on desktop */}
        <div className="hidden w-80 items-center gap-2 sm:flex lg:w-[28rem]" ref={searchRef}>
          <SmartSearchInput
            inputId="search-catalog"
            placeholder="Buscar produtos…  /"
            onSelect={onSelect}
            className="flex-1"
          />

          {/* History button — always visible, disabled/muted when empty */}
          <Popover open={historyOpen} onOpenChange={hasHistory ? setHistoryOpen : undefined}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={!hasHistory}
                      className={cn(
                        'group relative h-11 w-11 shrink-0 rounded-lg border-muted-foreground/20 transition-all',
                        hasHistory ? 'hover:border-primary/50' : 'cursor-default opacity-60',
                      )}
                      aria-label="Histórico de buscas recentes"
                    >
                      <Clock
                        className={cn(
                          'h-4 w-4 transition-colors',
                          hasHistory
                            ? 'text-muted-foreground group-hover:text-primary'
                            : 'text-muted-foreground',
                        )}
                      />
                      {hasHistory && (
                        <Badge className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center border-2 border-background bg-primary px-1 text-[8px]">
                          {searchHistory.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {hasHistory
                  ? `Histórico de buscas recentes (${searchHistory.length})`
                  : 'Nenhuma busca recente'}
              </TooltipContent>
            </Tooltip>
            {hasHistory && (
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
            )}
          </Popover>
        </div>

        <div className="hidden sm:block">
          <RecentlyViewedPopover maxVisible={10} />
        </div>
      </div>

      {/* Search full-width on mobile */}
      <div className="flex w-full items-center gap-2 sm:hidden">
        <SmartSearchInput placeholder="Buscar produtos..." onSelect={onSelect} className="flex-1" />
        {hasHistory && (
          <Button
            variant="outline"
            size="icon"
            className="relative h-11 w-11 shrink-0"
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            <Clock className="h-4 w-4" />
            <Badge className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center border-2 border-background bg-primary px-1 text-[8px]">
              {searchHistory.length}
            </Badge>
          </Button>
        )}
      </div>
    </div>
  );
}

export const CatalogHeader = memo(CatalogHeaderInner);
CatalogHeader.displayName = 'CatalogHeader';

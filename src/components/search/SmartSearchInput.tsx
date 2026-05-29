/**
 * SmartSearchInput — Search with autocomplete, voice, keyboard nav
 *
 * v2: Result rendering extracted to SearchResultGroups
 */
import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, X, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce, useSearch, useSearchHistory, type SearchResult } from '@/hooks/common';
import { useSpeechRecognition } from '@/hooks/intelligence';
import { GroupedSearchResults } from './SearchResultGroups';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartSearchInputProps {
  /** Unique id for the underlying <input>. Defaults to 'search'.
   *  Must be unique per page — pass a custom value when rendering
   *  multiple instances simultaneously (e.g. desktop + mobile). */
  inputId?: string;
  placeholder?: string;
  onSelect?: (result: SearchResult) => void;
  onSearch?: (query: string) => void;
  className?: string;
  autoFocus?: boolean;
}

export const SmartSearchInput = forwardRef<HTMLDivElement, SmartSearchInputProps>(
  function SmartSearchInput(
    {
      placeholder = 'Buscar produtos, categorias, fornecedores...',
      onSelect,
      onSearch,
      className,
      autoFocus = false,
      inputId = 'search',
    },
    _ref,
  ) {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isFocused, setIsFocused] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);

    const { query, setQuery, suggestions, quickSuggestions, clearHistory } = useSearch();

    const { history, addToHistory, removeFromHistory } = useSearchHistory('general');

    const debouncedQuery = useDebounce(query, 150);

    const handleVoiceResult = useCallback(
      (transcript: string) => {
        setQuery(transcript);
        inputRef.current?.focus();
      },
      [setQuery],
    );

    const { isListening } = useSpeechRecognition({
      onResult: handleVoiceResult,
      language: 'pt-BR',
    });

    useEffect(() => {
      if (debouncedQuery) {
        setIsSearching(true);
        const timer = setTimeout(() => setIsSearching(false), 200);
        return () => clearTimeout(timer);
      }
      setIsSearching(false);
    }, [debouncedQuery]);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsFocused(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
      setSelectedIndex(-1);
    }, [suggestions]);

    const handleSelectResult = useCallback(
      (result: SearchResult) => {
        if (result.type !== 'history') {
          addToHistory({ id: `history-${result.label}`, label: result.label, type: 'general' });
        }
        setQuery('');
        setIsFocused(false);
        setSelectedIndex(-1);

        if (onSelect) {
          onSelect(result);
          return;
        }

        switch (result.type) {
          case 'product':
            navigate(`/produto/${result.id}`);
            break;
          case 'category':
            navigate(`/?categoria=${result.id}`);
            break;
          case 'supplier':
            navigate(`/?fornecedor=${result.id}`);
            break;
          case 'history':
            setQuery(result.label);
            addToHistory({ id: `history-${result.label}`, label: result.label, type: 'general' });
            navigate(`/?search=${encodeURIComponent(result.label)}`);
            break;
        }
      },
      [addToHistory, setQuery, onSelect, navigate],
    );

    const submitSearch = useCallback(
      (q: string) => {
        if (!q.trim()) return;
        addToHistory({ id: `history-${q}`, label: q, type: 'general' });
        if (onSearch) {
          onSearch(q);
        } else {
          navigate(`/?search=${encodeURIComponent(q)}`);
        }
        setIsFocused(false);
      },
      [addToHistory, onSearch, navigate],
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
      const maxIndex = suggestions.length - 1;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((p) => (p < maxIndex ? p + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((p) => (p > 0 ? p - 1 : maxIndex));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            handleSelectResult(suggestions[selectedIndex]);
          } else if (query.trim()) {
            submitSearch(query);
          }
          break;
        case 'Escape':
          setIsFocused(false);
          inputRef.current?.blur();
          break;
      }
    };

    const showDropdown =
      isFocused && (suggestions.length > 0 || quickSuggestions.length > 0 || history.length > 0);

    return (
      <div ref={containerRef} className={cn('relative w-full', className)}>
        <Tooltip delayDuration={700} open={!isFocused ? undefined : false}>
          <TooltipTrigger asChild>
            <div className="group relative">
              <button
                type="button"
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0 transition-colors hover:text-primary"
                onClick={() => {
                  if (query.trim()) submitSearch(query);
                }}
                tabIndex={-1}
                aria-label="Buscar"
              >
                <Search
                  className={cn(
                    'h-4 w-4 transition-colors duration-200',
                    isFocused ? 'text-primary' : 'text-muted-foreground group-hover:text-primary',
                  )}
                />
              </button>

              <Input
                ref={inputRef}
                id={inputId}
                data-testid="catalog-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoFocus={autoFocus}
                aria-label="Campo de busca"
                aria-expanded={showDropdown}
                aria-haspopup="listbox"
                role="combobox"
                autoComplete="off"
                className={cn(
                  'h-11 border-muted-foreground/20 bg-background/80 pl-10 pr-20 backdrop-blur-sm transition-all duration-300 ease-out',
                  isFocused
                    ? 'border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.1)] ring-0'
                    : 'hover:border-muted-foreground/40',
                  isListening && 'animate-pulse ring-2 ring-primary ring-offset-2',
                )}
              />

              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {isSearching && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </motion.div>
                )}
                {query && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setQuery('');
                      onSearch?.('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Busca inteligente{' '}
            <kbd className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[5px]">⌘K</kbd>
          </TooltipContent>
        </Tooltip>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
              role="listbox"
            >
              <ScrollArea className="max-h-[420px]">
                {query && suggestions.length > 0 && (
                  <GroupedSearchResults
                    suggestions={suggestions}
                    selectedIndex={selectedIndex}
                    query={query}
                    onSelect={handleSelectResult}
                    onHover={setSelectedIndex}
                  />
                )}

                {!query && (
                  <>
                    {history.length > 0 && (
                      <div className="p-2">
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Buscas Recentes
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearHistory();
                            }}
                          >
                            Limpar
                          </Button>
                        </div>
                        {history.slice(0, 5).map((item, index) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted"
                            onClick={() => {
                              addToHistory(item);
                              submitSearch(item.label);
                            }}
                          >
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 truncate text-sm">{item.label}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromHistory(item.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    <Separator className="opacity-50" />

                    <div className="p-2">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        Sugestões Populares
                      </div>
                      <div className="flex flex-wrap gap-2 px-2 py-2">
                        {quickSuggestions.map((suggestion, index) => (
                          <motion.div
                            key={suggestion.label}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.04 }}
                          >
                            <Badge
                              variant="secondary"
                              className="cursor-pointer transition-all duration-200 hover:scale-105 hover:bg-primary hover:text-primary-foreground"
                              onClick={() => submitSearch(suggestion.label)}
                            >
                              {suggestion.icon} {suggestion.label}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {query && suggestions.length === 0 && !isSearching && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center text-muted-foreground"
                  >
                    <Search className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    <p className="font-medium">
                      Nenhum resultado para "<span className="text-foreground">{query}</span>"
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground/70">
                      Tente buscar por nome, SKU ou categoria
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-xs"
                      onClick={() => submitSearch(query)}
                    >
                      <Search className="mr-1.5 h-3 w-3" />
                      Buscar "{query}" no catálogo completo
                    </Button>
                  </motion.div>
                )}
              </ScrollArea>

              <div className="flex items-center justify-between border-t border-border/50 bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground/70">
                <div className="flex items-center gap-3">
                  <span>
                    <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">↑↓</kbd>{' '}
                    navegar
                  </span>
                  <span>
                    <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">Enter</kbd>{' '}
                    selecionar
                  </span>
                  <span>
                    <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">Esc</kbd>{' '}
                    fechar
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">⌘K</kbd> busca
                  global
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

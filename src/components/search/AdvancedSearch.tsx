import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, TrendingUp, ArrowRight, Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { VisualSearchButton } from './VisualSearchButton';
import { cn } from '@/lib/utils';
import { useSearch, type SearchResult } from '@/hooks/common';
import type { VoiceAgentAction } from '@/hooks/voice/types';
import { useProductAnalytics } from '@/hooks/products';
import { useSpeechRecognition } from '@/hooks/intelligence';

const LazyVoiceOverlay = lazy(() => import('./VoiceSearchOverlayConnected'));

interface ProductAnalysis {
  productType: string;
  material: string;
  colors: string[];
  category: string;
  keywords: string[];
  description: string;
}

/** Shape emitted by VisualSearchButton's internal SearchResult */
interface VisualSearchProduct {
  id: string;
  name: string;
  sku: string;
  category_name: string;
  description: string;
  price: number;
  colors: string[] | null | undefined;
  relevance: number;
}

interface AdvancedSearchProps {
  onSearch?: (query: string) => void;
  onVisualSearchResults?: (products: VisualSearchProduct[], analysis: ProductAnalysis) => void;
  className?: string;
}

export function AdvancedSearch({
  onSearch,
  onVisualSearchResults,
  className,
}: AdvancedSearchProps) {
  const navigate = useNavigate();
  const { trackSearch } = useProductAnalytics();
  const {
    query,
    setQuery,
    suggestions,
    quickSuggestions,
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  } = useSearch();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Voice support detection + live listening state (overlay drives the actual agent)
  const { isListening, transcript, isSupported: isVoiceSupported } = useSpeechRecognition();

  // Voice agent (ElevenLabs + AI)
  const handleVoiceAction = useCallback(
    (action: VoiceAgentAction) => {
      switch (action.action) {
        case 'search':
        case 'filter': {
          const searchTerm = action.data?.query ?? '';
          const filterParts: string[] = [];
          if (action.data?.filters?.category) filterParts.push(action.data.filters.category);
          if (action.data?.filters?.color) filterParts.push(action.data.filters.color);
          const finalQuery = searchTerm || filterParts.join(' ');
          if (finalQuery) {
            setIsVoiceOverlayOpen(false);
            setQuery(finalQuery);
            onSearch?.(finalQuery);
          }
          break;
        }
        case 'navigate':
          if (action.data?.route) {
            setIsVoiceOverlayOpen(false);
            navigate(action.data.route);
          }
          break;
        case 'clear':
          setIsVoiceOverlayOpen(false);
          setQuery('');
          break;
        default:
          break;
      }
    },
    // FIX BUG-GS-04: added setQuery to deps — it is used in cases 'search','filter','clear'
    // but was missing, creating a stale closure.
    [navigate, onSearch, setQuery],
  );

  const handleOpenVoiceOverlay = () => {
    setIsVoiceOverlayOpen(true);
  };

  const handleCloseVoiceOverlay = () => {
    setIsVoiceOverlayOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'product') {
      navigate(`/produto/${result.id}`);
      addToHistory(result.label);
    } else if (result.type === 'category') {
      navigate(`/filtros?categoria=${result.id}`);
      addToHistory(result.label);
    } else if (result.type === 'supplier') {
      navigate(`/filtros?fornecedor=${result.id}`);
      addToHistory(result.label);
    } else if (result.type === 'history') {
      setQuery(result.label);
      onSearch?.(result.label);
    }
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleQuickSearch = (term: string) => {
    setQuery(term);
    addToHistory(term);
    onSearch?.(term);
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addToHistory(query);
      onSearch?.(query);
      // Track search analytics
      trackSearch({
        searchTerm: query,
        resultsCount: suggestions.filter((s) => s.type === 'product').length,
      });
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        } else if (query.trim()) {
          handleSubmit(e);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder={
              isListening ? 'Ouvindo...' : 'Buscar produtos, categorias, fornecedores...'
            }
            value={isListening ? transcript : query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className={cn(
              'h-10 border-border/50 bg-secondary/50 pl-10 pr-28 transition-colors focus:bg-background',
              isListening && 'border-primary ring-2 ring-primary/20',
            )}
          />
          <div className="absolute right-1 flex items-center gap-0.5">
            {query && !isListening && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fechar"
                className="h-8 w-8"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            {/* Visual Search Button */}
            <VisualSearchButton
              onResultsFound={(products, analysis) => {
                onVisualSearchResults?.(products, analysis);
              }}
            />

            {isVoiceSupported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 transition-all"
                    onClick={handleOpenVoiceOverlay}
                    aria-label="Microfone"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Buscar por voz</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </form>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full z-50 mt-2 animate-fade-in overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
        >
          {/* Suggestions */}
          {suggestions.length > 0 ? (
            <div className="py-2">
              {suggestions.map((result, index) => (
                <button
                  key={result.id}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    'hover:bg-accent',
                    selectedIndex === index && 'bg-accent',
                  )}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="shrink-0 text-lg">{result.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{result.label}</p>
                    {result.sublabel && (
                      <p className="truncate text-xs text-muted-foreground">{result.sublabel}</p>
                    )}
                  </div>
                  {result.type === 'history' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Fechar"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(result.label);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  {result.type === 'product' && (
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum resultado para "{query}"</p>
            </div>
          ) : null}

          {/* Quick suggestions when no query */}
          {!query && (
            <>
              {history.length > 0 && (
                <div className="border-b border-border px-4 py-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Buscas recentes
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={clearHistory}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-t border-border p-4">
                <p className="mb-3 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  Sugestões populares
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickSuggestions.map((suggestion) => (
                    <Badge
                      key={suggestion.label}
                      variant="secondary"
                      className="cursor-pointer transition-colors hover:bg-primary hover:text-primary-foreground"
                      onClick={() => handleQuickSearch(suggestion.label)}
                    >
                      {suggestion.icon} {suggestion.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Voice Search Overlay (lazy-loaded) */}
      {isVoiceOverlayOpen && (
        <Suspense fallback={null}>
          <LazyVoiceOverlay
            isOpen={isVoiceOverlayOpen}
            onClose={handleCloseVoiceOverlay}
            onAction={handleVoiceAction}
          />
        </Suspense>
      )}
    </div>
  );
}

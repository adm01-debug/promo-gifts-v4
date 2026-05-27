import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  ArrowRight,
  Clock,
  TrendingUp,
  Package,
  FileText,
  Users,
  ShoppingCart,
  Sparkles,
  Filter,
  Keyboard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  category: 'product' | 'quote' | 'client' | 'order' | 'page' | 'action';
  url: string;
  icon?: React.ReactNode;
  metadata?: Record<string, string>;
  score?: number;
}

interface SearchHistory {
  query: string;
  timestamp: number;
  resultCount: number;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  placeholder?: string;
}

const categoryConfig = {
  product: { icon: Package, label: 'Produto', color: 'text-primary' },
  quote: { icon: FileText, label: 'Orçamento', color: 'text-success' },
  client: { icon: Users, label: 'Cliente', color: 'text-primary' },
  order: { icon: ShoppingCart, label: 'Pedido', color: 'text-brand-primary' },
  page: { icon: ArrowRight, label: 'Página', color: 'text-muted-foreground' },
  action: { icon: Sparkles, label: 'Ação', color: 'text-primary' },
};

const quickActions = [
  { id: 'new-quote', label: 'Novo Orçamento', url: '/orcamentos/novo', icon: FileText },
  { id: 'products', label: 'Catálogo de Produtos', url: '/filtros', icon: Package },
  { id: 'dashboard', label: 'Dashboard', url: '/bi', icon: TrendingUp },
];

export function GlobalSearch({
  isOpen,
  onClose,
  placeholder = 'Buscar produtos, orçamentos, clientes...',
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('search-history');
    if (history) {
      setSearchHistory(JSON.parse(history).slice(0, 5));
    }
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setActiveFilter(null);
    }
  }, [isOpen]);

  // Mock search - replace with actual API call
  const performSearch = useCallback(async (searchQuery: string, filter?: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Mock results
    const mockResults: SearchResult[] = (
      [
        {
          id: '1',
          title: 'Caneta Personalizada Premium',
          description: 'SKU: CAN-001 - Categoria: Escritório',
          category: 'product',
          url: '/produtos/1',
          metadata: { price: 'R$ 5,90', stock: '1.250 un' } as Record<string, string>,
        },
        {
          id: '2',
          title: 'Orçamento #2024-0125',
          description: 'Cliente: Empresa ABC Ltda',
          category: 'quote',
          url: '/orcamentos/2',
          metadata: { value: 'R$ 15.000,00', status: 'Pendente' } as Record<string, string>,
        },
      ] as SearchResult[]
    ).filter(
      (r) =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const filteredResults = filter ? mockResults.filter((r) => r.category === filter) : mockResults;

    setResults(filteredResults);
    setIsLoading(false);
    setSelectedIndex(0);
  }, []);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query, activeFilter || undefined);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [query, activeFilter, performSearch]);

  // Keyboard navigation
  // FIX BUG-GS-08: wrap handleResultClick in useCallback and add to useEffect deps.
  // Previously handleResultClick was defined after the useEffect and was not
  // memoized, creating a stale closure — the Enter key handler would call
  // a version of handleResultClick that captured stale query/searchHistory values.
  const handleResultClick = useCallback(
    (result: SearchResult) => {
      // Save to history
      const newHistory: SearchHistory = {
        query,
        timestamp: Date.now(),
        resultCount: results.length,
      };
      const updatedHistory = [newHistory, ...searchHistory.filter((h) => h.query !== query)].slice(
        0,
        5,
      );
      setSearchHistory(updatedHistory);
      localStorage.setItem('search-history', JSON.stringify(updatedHistory));

      navigate(result.url);
      onClose();
    },
    [query, results.length, searchHistory, navigate, onClose],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, (query ? results.length : quickActions.length) - 1),
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (query && results[selectedIndex]) {
            handleResultClick(results[selectedIndex]);
          } else if (!query && quickActions[selectedIndex]) {
            navigate(quickActions[selectedIndex].url);
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, results, query, navigate, onClose, handleResultClick]);

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('search-history');
  };

  const filters = useMemo(
    () => [
      { id: 'product', label: 'Produtos' },
      { id: 'quote', label: 'Orçamentos' },
      { id: 'client', label: 'Clientes' },
    ],
    [],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Search Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[10%] z-50 w-full max-w-2xl -translate-x-1/2 px-4"
          >
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              {/* Search Input */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                />
                {query && (
                  <button
                    aria-label="Fechar"
                    onClick={() => setQuery('')}
                    className="rounded-full p-1 transition-colors hover:bg-muted"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                <kbd className="hidden items-center gap-1 rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground sm:flex">
                  ESC
                </kbd>
              </div>

              {/* Filters */}
              <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
                <Filter className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(activeFilter === filter.id ? null : filter.id)}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      activeFilter === filter.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="max-h-[60vh] overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : query ? (
                  results.length > 0 ? (
                    <div className="py-2">
                      {results.map((result, index) => {
                        const CategoryIcon = categoryConfig[result.category].icon;
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className={cn(
                              'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                              index === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50',
                            )}
                          >
                            <div
                              className={cn(
                                'rounded-lg bg-muted p-2',
                                categoryConfig[result.category].color,
                              )}
                            >
                              <CategoryIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium text-foreground">
                                  {result.title}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {categoryConfig[result.category].label}
                                </Badge>
                              </div>
                              {result.description && (
                                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                  {result.description}
                                </p>
                              )}
                              {result.metadata && (
                                <div className="mt-1 flex items-center gap-3">
                                  {Object.entries(result.metadata).map(([key, value]) => (
                                    <span key={key} className="text-xs text-muted-foreground">
                                      {value}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <Search className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                      <p className="text-muted-foreground">Nenhum resultado para "{query}"</p>
                    </div>
                  )
                ) : (
                  <div className="py-4">
                    {/* Search History */}
                    {searchHistory.length > 0 && (
                      <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between px-4">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Buscas recentes
                          </span>
                          <button
                            onClick={clearHistory}
                            className="text-xs text-primary hover:underline"
                          >
                            Limpar
                          </button>
                        </div>
                        {searchHistory.map((item) => (
                          <button
                            key={item.query}
                            onClick={() => setQuery(item.query)}
                            className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted"
                          >
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">{item.query}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {item.resultCount} resultados
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div>
                      <div className="mb-2 px-4">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Ações rápidas
                        </span>
                      </div>
                      {quickActions.map((action, index) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.id}
                            onClick={() => {
                              navigate(action.url);
                              onClose();
                            }}
                            className={cn(
                              'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                              index === selectedIndex && !query ? 'bg-muted' : 'hover:bg-muted/50',
                            )}
                          >
                            <div className="rounded-lg bg-primary/10 p-2">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {action.label}
                            </span>
                            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Keyboard className="h-3 w-3" />
                    <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">↑↓</kbd>
                    navegar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">↵</kbd>
                    selecionar
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Busca inteligente
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// FIX BUG-GS-13: renamed from useGlobalSearch → useLegacyGlobalSearch to avoid
// name collision with the real hook in useGlobalSearch.ts. The legacy hook uses
// local state + mock data and is NOT the production search hook.
/** @deprecated Use useGlobalSearch from './useGlobalSearch' instead. */
export function useLegacyGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}

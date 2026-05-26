import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Clock, Lightbulb, ArrowRight, Tag, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Suggestion {
  id: string;
  type: 'trending' | 'recent' | 'recommended' | 'related' | 'promotion';
  title: string;
  description?: string;
  category?: string;
  url: string;
  metadata?: {
    views?: number;
    popularity?: number;
    discount?: number;
  };
}

interface SmartSuggestionsProps {
  context?: 'products' | 'quotes' | 'clients' | 'general';
  currentItem?: string;
  maxItems?: number;
  showHeader?: boolean;
  className?: string;
  onSelect?: (suggestion: Suggestion) => void;
}

const typeConfig = {
  trending: {
    icon: TrendingUp,
    label: 'Em alta',
    color: 'text-brand-primary',
    bg: 'bg-brand-primary/10',
  },
  recent: { icon: Clock, label: 'Recente', color: 'text-primary', bg: 'bg-primary/10' },
  recommended: { icon: Sparkles, label: 'Recomendado', color: 'text-primary', bg: 'bg-primary/10' },
  related: { icon: Tag, label: 'Relacionado', color: 'text-primary', bg: 'bg-primary/10' },
  promotion: {
    icon: Percent,
    label: 'Promoção',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
};

export function SmartSuggestions({
  context = 'general',
  currentItem,
  maxItems = 5,
  showHeader = true,
  className,
  onSelect,
}: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data - replace with actual AI/ML recommendations
  useEffect(() => {
    const loadSuggestions = async () => {
      setIsLoading(true);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      const mockSuggestions: Suggestion[] = [
        {
          id: '1',
          type: 'trending',
          title: 'Caneta Esferográfica Touch',
          description: 'Mais vendido este mês',
          category: 'Escritório',
          url: '/produtos/1',
          metadata: { views: 1250, popularity: 95 },
        },
        {
          id: '2',
          type: 'recommended',
          title: 'Kit Executivo Premium',
          description: 'Baseado nas suas vendas',
          category: 'Kits',
          url: '/produtos/2',
          metadata: { popularity: 88 },
        },
        {
          id: '3',
          type: 'promotion',
          title: 'Agenda 2025 Personalizada',
          description: '20% OFF até sexta',
          category: 'Papelaria',
          url: '/produtos/3',
          metadata: { discount: 20 },
        },
        {
          id: '4',
          type: 'related',
          title: 'Bloco de Notas Sustentável',
          description: 'Combina com sua seleção',
          category: 'Eco',
          url: '/produtos/4',
        },
        {
          id: '5',
          type: 'recent',
          title: 'Garrafa Térmica 500ml',
          description: 'Visualizado há 2h',
          category: 'Drinkware',
          url: '/produtos/5',
        },
      ];

      setSuggestions(mockSuggestions.slice(0, maxItems));
      setIsLoading(false);
    };

    loadSuggestions();
  }, [context, currentItem, maxItems]);

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {showHeader && (
          <div className="flex items-center gap-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        )}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showHeader && (
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Sugestões inteligentes</span>
          <Badge variant="secondary" className="text-[10px]">
            IA
          </Badge>
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {suggestions.map((suggestion, index) => {
            const config = typeConfig[suggestion.type];
            const Icon = config.icon;

            return (
              <motion.button
                key={suggestion.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelect?.(suggestion)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl p-3',
                  'border border-border bg-card',
                  'hover:border-primary/30 hover:shadow-md',
                  'group text-left transition-all duration-200',
                )}
              >
                <div className={cn('flex-shrink-0 rounded-lg p-2', config.bg)}>
                  <Icon className={cn('h-4 w-4', config.color)} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {suggestion.title}
                    </span>
                    {suggestion.metadata?.discount && (
                      <Badge variant="destructive" className="text-[10px]">
                        -{suggestion.metadata.discount}%
                      </Badge>
                    )}
                  </div>
                  {suggestion.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {suggestion.description}
                    </p>
                  )}
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Inline suggestions for search input
interface InlineSuggestionsProps {
  query: string;
  onSelect: (suggestion: string) => void;
  className?: string;
}

export function InlineSuggestions({ query, onSelect, className }: InlineSuggestionsProps) {
  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];

    // Mock autocomplete - replace with actual API
    const allSuggestions = [
      'caneta personalizada',
      'caneta esferográfica',
      'caneta touch screen',
      'camiseta polo',
      'camiseta dry fit',
      'caderno espiral',
      'caderno personalizado',
      'garrafa térmica',
      'garrafa squeeze',
    ];

    // Usar Fuse.js para busca fuzzy
    const fuse = new Fuse(allSuggestions, {
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });

    const results = fuse.search(query);
    return results.map((r) => r.item).slice(0, 5);
  }, [query]);

  if (suggestions.length === 0) return null;

  return (
    <div className={cn('border-b border-border py-1', className)}>
      <div className="flex flex-wrap gap-1.5 px-4">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            className={cn(
              'rounded-full px-3 py-1 text-sm',
              'bg-muted/50 text-muted-foreground',
              'hover:bg-primary/10 hover:text-primary',
              'transition-colors',
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

// Search filters with smart defaults
interface SmartFiltersProps {
  context?: string;
  activeFilters: Record<string, string[]>;
  onFilterChange: (key: string, values: string[]) => void;
  className?: string;
}

export function SmartFilters({
  context,
  activeFilters,
  onFilterChange,
  className,
}: SmartFiltersProps) {
  const [suggestedFilters, setSuggestedFilters] = useState<
    Array<{
      key: string;
      label: string;
      value: string;
      reason: string;
    }>
  >([]);

  useEffect(() => {
    // Mock AI-suggested filters
    setSuggestedFilters([
      { key: 'category', label: 'Escritório', value: 'escritorio', reason: 'Mais popular' },
      { key: 'price', label: 'Até R$ 10', value: '0-10', reason: 'Dentro do orçamento médio' },
      { key: 'stock', label: 'Pronta entrega', value: 'in_stock', reason: 'Entrega rápida' },
    ]);
  }, [context]);

  const isFilterActive = (key: string, value: string) => {
    return activeFilters[key]?.includes(value);
  };

  const toggleFilter = (key: string, value: string) => {
    const currentValues = activeFilters[key] || [];
    const newValues = isFilterActive(key, value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    onFilterChange(key, newValues);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary" />
        <span>Filtros sugeridos</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestedFilters.map((filter) => (
          <button
            key={`${filter.key}-${filter.value}`}
            onClick={() => toggleFilter(filter.key, filter.value)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs transition-all',
              isFilterActive(filter.key, filter.value)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30',
            )}
            title={filter.reason}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}

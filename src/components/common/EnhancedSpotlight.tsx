import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOptionalOnboardingContext } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { m as motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { Search, ArrowRight, Command, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildSpotlightItems, type SpotlightItem } from './spotlight/SpotlightItems';
import { useAuth } from '@/contexts/AuthContext';
import { filterByRoutePermission } from '@/lib/navigation/filter-restricted-items';

// SpotlightItem type imported from ./spotlight/SpotlightItems

export function EnhancedSpotlight() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { isDev, isAdmin } = useAuth();
  const onboarding = useOptionalOnboardingContext();

  const handleRestartTour = () => {
    if (onboarding) {
      onboarding.restartTour();
    }
  };

  // Load recent actions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('spotlight-recent');
    if (stored) {
      try {
        setRecentActions(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const addToRecent = (id: string) => {
    const updated = [id, ...recentActions.filter((r) => r !== id)].slice(0, 5);
    setRecentActions(updated);
    localStorage.setItem('spotlight-recent', JSON.stringify(updated));
  };

  const items: SpotlightItem[] = useMemo(() => {
    const all = buildSpotlightItems(navigate, handleRestartTour);
    // Esconde itens cujas rotas exigem papel que o usuário não tem.
    return filterByRoutePermission(all, (i) => i.path, { isDev, isAdmin });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, isDev, isAdmin]);

  // O(1) lookup map — recomputed only when items list changes, not on every keystroke.
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // O(1) membership test — recomputed only when recentActions changes.
  const recentSet = useMemo(() => new Set(recentActions), [recentActions]);

  // Fuse.js para busca fuzzy
  const fuse = useMemo(() => {
    return new Fuse(items, {
      keys: [
        { name: 'title', weight: 0.5 },
        { name: 'description', weight: 0.3 },
        { name: 'category', weight: 0.2 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
  }, [items]);

  // Filter items based on query using fuzzy search
  const filteredItems = useMemo(() => {
    if (!query) {
      // Show recent items first, then quick actions
      const recentItems = recentActions
        .map((id) => itemsById.get(id))
        .filter(Boolean) as SpotlightItem[];

      const quickActions = items.filter((item) => item.isQuickAction);
      const others = items.filter((item) => !item.isQuickAction && !recentSet.has(item.id));

      return [...recentItems, ...quickActions, ...others];
    }

    // Use Fuse.js for fuzzy search
    const results = fuse.search(query);
    return results.map((r) => r.item);
  }, [query, items, recentActions, recentSet, itemsById, fuse]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, SpotlightItem[]> = {};

    // If showing recent, add that category
    if (!query && recentActions.length > 0) {
      const recentItems = recentActions
        .map((id) => itemsById.get(id))
        .filter(Boolean) as SpotlightItem[];

      if (recentItems.length > 0) {
        groups.Recentes = recentItems;
      }
    }

    const recentIdSet = new Set(groups.Recentes?.map((r) => r.id) ?? []);
    filteredItems.forEach((item) => {
      if (recentIdSet.has(item.id)) return;

      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });

    return groups;
  }, [filteredItems, recentActions, itemsById, query]);

  // Flatten for keyboard navigation
  const flatItems = useMemo(() => {
    return Object.values(groupedItems).flat();
  }, [groupedItems]);

  // Keyboard handlers
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Toggle with Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
        return;
      }

      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        setQuery('');
        return;
      }

      // Only handle these when open
      if (!isOpen) return;

      // Navigate with arrows
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }

      // Select with Enter
      if (e.key === 'Enter' && flatItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(flatItems[selectedIndex]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, flatItems, selectedIndex],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (item: SpotlightItem) => {
    addToRecent(item.id);
    item.action();
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Spotlight Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed left-1/2 top-[12%] z-[101] w-full max-w-xl -translate-x-1/2 px-4"
          >
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              {/* Search Input */}
              <div className="flex items-center border-b border-border px-4">
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar ações, páginas, ferramentas..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-4 text-base outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
                <div className="flex items-center gap-1">
                  <kbd className="hidden rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground sm:inline-block">
                    ESC
                  </kbd>
                </div>
              </div>

              {/* Quick Action Pills */}
              {!query && (
                <div className="flex flex-wrap gap-2 border-b border-border bg-muted/30 px-4 py-3">
                  {items
                    .filter((item) => item.isQuickAction)
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className={cn(
                          'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm',
                          'bg-primary/10 text-primary hover:bg-primary/20',
                          'transition-colors duration-150 active:scale-95',
                        )}
                      >
                        {item.icon}
                        <span>{item.title}</span>
                        {item.shortcut && (
                          <kbd className="ml-1 rounded bg-primary/20 px-1.5 py-0.5 text-xs">
                            {item.shortcut}
                          </kbd>
                        )}
                      </button>
                    ))}
                </div>
              )}

              {/* Results */}
              <div className="scrollbar-thin max-h-[400px] overflow-y-auto p-2">
                {Object.entries(groupedItems).map(([category, categoryItems]) => (
                  <div key={category} className="mb-2">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {category === 'Recentes' && <Clock className="h-3 w-3" />}
                      {category === 'Ações Rápidas' && <Zap className="h-3 w-3" />}
                      {category}
                    </div>
                    {categoryItems.map((item) => {
                      const globalIndex = flatItems.findIndex((f) => f.id === item.id);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                            'transition-colors duration-100',
                            'focus:outline-none',
                            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted',
                            )}
                          >
                            {item.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{item.title}</div>
                            {item.description && (
                              <div className="truncate text-sm text-muted-foreground">
                                {item.description}
                              </div>
                            )}
                          </div>
                          {item.shortcut && (
                            <kbd className="hidden rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground sm:block">
                              {item.shortcut}
                            </kbd>
                          )}
                          <ArrowRight
                            className={cn(
                              'h-4 w-4 shrink-0 transition-transform',
                              isSelected ? 'translate-x-0.5 text-primary' : 'text-muted-foreground',
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                ))}

                {flatItems.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    <Search className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p className="font-medium">Nenhum resultado</p>
                    <p className="mt-1 text-sm">Tente buscar por "{query.slice(0, 10)}..."</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <kbd className="rounded bg-muted px-1.5 py-0.5 font-medium">↑↓</kbd>
                    <span>Navegar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="rounded bg-muted px-1.5 py-0.5 font-medium">↵</kbd>
                    <span>Selecionar</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Command className="h-3 w-3" />
                  <span>K para fechar</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Trigger button component
export function EnhancedSpotlightTrigger({ className }: { className?: string }) {
  const handleClick = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground',
        'transition-all duration-150 hover:border-border/80 hover:bg-muted hover:text-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'active:scale-[0.98]',
        className,
      )}
      aria-label="Buscar"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Buscar...</span>
      <kbd className="hidden items-center gap-0.5 rounded border border-border/50 bg-background px-1.5 py-0.5 text-xs font-medium sm:inline-flex">
        <Command className="h-3 w-3" />K
      </kbd>
    </button>
  );
}

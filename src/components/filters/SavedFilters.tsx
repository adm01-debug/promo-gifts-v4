import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Trash2,
  Star,
  StarOff,
  Filter,
  X,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
// ============================================================================
// TYPES
// ============================================================================

export interface SavedFilter<T = Record<string, unknown>> {
  id: string;
  name: string;
  filters: T;
  isDefault?: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

export interface SavedFiltersProps<T = Record<string, unknown>> {
  storageKey: string;
  currentFilters: T;
  onApplyFilter: (filters: T) => void;
  onClearFilters: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}

// ============================================================================
// HOOK: useSavedFilters
// ============================================================================

export function useSavedFilters<T = Record<string, unknown>>(storageKey: string) {
  const [savedFilters, setSavedFilters] = React.useState<Array<SavedFilter<T>>>([]);

  // Load from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(`filters_${storageKey}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Array<SavedFilter<T>>;
        // Convert date strings back to Date objects
        setSavedFilters(
          parsed.map((f) => ({
            ...f,
            createdAt: new Date(f.createdAt),
            lastUsed: f.lastUsed ? new Date(f.lastUsed) : undefined,
          })),
        );
      }
    } catch (e) {
      logger.error('Failed to load saved filters:', e);
    }
  }, [storageKey]);

  // Save to localStorage whenever filters change
  const persistFilters = React.useCallback(
    (filters: Array<SavedFilter<T>>) => {
      try {
        localStorage.setItem(`filters_${storageKey}`, JSON.stringify(filters));
      } catch (e) {
        logger.error('Failed to save filters:', e);
      }
    },
    [storageKey],
  );

  const saveFilter = React.useCallback(
    (name: string, filters: T) => {
      const newFilter: SavedFilter<T> = {
        id: crypto.randomUUID(),
        name,
        filters,
        createdAt: new Date(),
      };

      setSavedFilters((prev) => {
        const updated = [...prev, newFilter];
        persistFilters(updated);
        return updated;
      });

      return newFilter;
    },
    [persistFilters],
  );

  const deleteFilter = React.useCallback(
    (id: string) => {
      setSavedFilters((prev) => {
        const updated = prev.filter((f) => f.id !== id);
        persistFilters(updated);
        return updated;
      });
    },
    [persistFilters],
  );

  const updateFilter = React.useCallback(
    (id: string, updates: Partial<SavedFilter<T>>) => {
      setSavedFilters((prev) => {
        const updated = prev.map((f) => (f.id === id ? { ...f, ...updates } : f));
        persistFilters(updated);
        return updated;
      });
    },
    [persistFilters],
  );

  const setDefaultFilter = React.useCallback(
    (id: string) => {
      setSavedFilters((prev) => {
        const updated = prev.map((f) => ({
          ...f,
          isDefault: f.id === id,
        }));
        persistFilters(updated);
        return updated;
      });
    },
    [persistFilters],
  );

  const markAsUsed = React.useCallback(
    (id: string) => {
      setSavedFilters((prev) => {
        const updated = prev.map((f) => (f.id === id ? { ...f, lastUsed: new Date() } : f));
        persistFilters(updated);
        return updated;
      });
    },
    [persistFilters],
  );

  const getDefaultFilter = React.useCallback(() => {
    return savedFilters.find((f) => f.isDefault);
  }, [savedFilters]);

  return {
    savedFilters,
    saveFilter,
    deleteFilter,
    updateFilter,
    setDefaultFilter,
    markAsUsed,
    getDefaultFilter,
  };
}

// ============================================================================
// SAVED FILTERS COMPONENT
// ============================================================================

export function SavedFilters<T = Record<string, unknown>>({
  storageKey,
  currentFilters,
  onApplyFilter,
  onClearFilters,
  hasActiveFilters = false,
  className,
}: SavedFiltersProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaveMode, setIsSaveMode] = React.useState(false);
  const [newFilterName, setNewFilterName] = React.useState('');
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  const { savedFilters, saveFilter, deleteFilter, setDefaultFilter, markAsUsed } =
    useSavedFilters<T>(storageKey);

  const handleSaveFilter = () => {
    if (!newFilterName.trim()) {
      toast.error('Digite um nome para o filtro');
      return;
    }

    saveFilter(newFilterName.trim(), currentFilters);
    toast.success('Filtro salvo com sucesso!');
    setNewFilterName('');
    setIsSaveMode(false);
  };

  const handleApplyFilter = (filter: SavedFilter<T>) => {
    onApplyFilter(filter.filters);
    markAsUsed(filter.id);
    setIsOpen(false);
    toast.success(`Filtro "${filter.name}" aplicado`);
  };

  const handleDeleteFilter = (id: string) => {
    deleteFilter(id);
    setDeleteConfirmId(null);
    toast.success('Filtro excluído');
  };

  const handleSetDefault = (id: string, currentDefault: boolean) => {
    if (currentDefault) {
      setDefaultFilter('');
      toast.info('Filtro removido dos favoritos');
    } else {
      setDefaultFilter(id);
      toast.success('Filtro definido como favorito');
    }
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('gap-2', hasActiveFilters && 'border-primary text-primary', className)}
          >
            <Bookmark className="h-4 w-4" />
            Filtros salvos
            {savedFilters.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {savedFilters.length}
              </span>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="border-b p-3">
            <h4 className="text-sm font-semibold">Filtros Salvos</h4>
            <p className="text-xs text-muted-foreground">
              Acesse rapidamente suas configurações de filtro
            </p>
          </div>

          {isSaveMode ? (
            <div className="border-b p-3 duration-200 animate-in fade-in">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do filtro..."
                  value={newFilterName}
                  onChange={(e) => setNewFilterName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveFilter()}
                  autoFocus
                  className="h-8"
                />
                <Button size="sm" onClick={handleSaveFilter} className="h-8">
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsSaveMode(false);
                    setNewFilterName('');
                  }}
                  className="h-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : hasActiveFilters ? (
            <div className="border-b p-3 duration-200 animate-in fade-in">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaveMode(true)}
                className="w-full gap-2"
              >
                <BookmarkPlus className="h-4 w-4" />
                Salvar filtros atuais
              </Button>
            </div>
          ) : null}

          <div className="max-h-64 overflow-auto">
            {savedFilters.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Filter className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">Nenhum filtro salvo</p>
                <p className="text-xs">Aplique filtros e salve para acesso rápido</p>
              </div>
            ) : (
              <ul className="py-1">
                {savedFilters.map((filter) => (
                  <li key={filter.id}>
                    <div className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/50">
                      <button
                        onClick={() => handleApplyFilter(filter)}
                        className="flex-1 text-left"
                      >
                        <span className="text-sm font-medium">{filter.name}</span>
                        {filter.lastUsed && (
                          <span className="block text-xs text-muted-foreground">
                            Usado: {filter.lastUsed.toLocaleDateString()}
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Favoritar"
                          className="h-7 w-7"
                          onClick={() => handleSetDefault(filter.id, !!filter.isDefault)}
                        >
                          {filter.isDefault ? (
                            <Star className="h-4 w-4 fill-yellow-500 text-warning" />
                          ) : (
                            <StarOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(filter.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hasActiveFilters && (
            <div className="border-t p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="w-full text-muted-foreground"
              >
                <X className="mr-2 h-4 w-4" />
                Limpar filtros atuais
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir filtro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O filtro será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteFilter(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// QUICK FILTER CHIPS
// ============================================================================

export interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
  className?: string;
}

export function FilterChip({ label, value, onRemove, className }: FilterChipProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-sm text-primary',
        'duration-200 animate-in fade-in zoom-in-90',
        className,
      )}
    >
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 transition-colors hover:bg-primary/20"
        aria-label={`Remover filtro ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export interface ActiveFiltersBarProps {
  filters: Array<{ key: string; label: string; value: string }>;
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
  className?: string;
}

export function ActiveFiltersBar({
  filters,
  onRemoveFilter,
  onClearAll,
  className,
}: ActiveFiltersBarProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground">Filtros ativos:</span>
      {filters.map((filter) => (
        <FilterChip
          key={filter.key}
          label={filter.label}
          value={filter.value}
          onRemove={() => onRemoveFilter(filter.key)}
        />
      ))}
      {filters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-7 text-xs text-muted-foreground"
        >
          Limpar todos
        </Button>
      )}
    </div>
  );
}

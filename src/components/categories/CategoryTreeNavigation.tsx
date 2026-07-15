import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Search, X } from 'lucide-react';
import { useCategoriesTree, type CategoryNode, type CategoryTreeItem } from '@/hooks/products';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CategoryTreeNavigationProps {
  onSelectCategory?: (category: CategoryTreeItem) => void;
  selectedCategoryId?: string | null;
  showSearch?: boolean;
  maxHeight?: string;
  className?: string;
}

// Componente de nó da árvore
function TreeNode({
  node,
  level,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
}: {
  node: CategoryNode;
  level: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: CategoryNode) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          'hover:bg-accent/50',
          isSelected && 'bg-primary/10 font-medium text-primary',
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node);
          }
        }}
      >
        {/* Botão de expandir/colapsar */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="rounded p-0.5 hover:bg-muted"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Ícone de pasta */}
        {hasChildren ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 text-warning" />
          ) : (
            <Folder className="h-4 w-4 text-warning" />
          )
        ) : (
          <div className="flex h-4 w-4 items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
          </div>
        )}

        {/* Nome da categoria */}
        <span className="truncate text-sm">{node.name}</span>

        {/* Badge com contagem de filhos */}
        {hasChildren && (
          <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-xs">
            {node.children.length}
          </Badge>
        )}
      </div>

      {/* Filhos */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Componente de resultado de busca
function SearchResult({
  category,
  isSelected,
  onSelect,
}: {
  category: CategoryTreeItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        'hover:bg-accent/50',
        isSelected && 'bg-primary/10 text-primary',
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <Folder className="h-4 w-4 flex-shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{category.name}</p>
        {category.tree_structure && (
          <p className="truncate text-xs text-muted-foreground">{category.tree_structure}</p>
        )}
      </div>
      <Badge variant="outline" className="text-xs">
        Nível {category.level}
      </Badge>
    </div>
  );
}

export function CategoryTreeNavigation({
  onSelectCategory,
  selectedCategoryId,
  showSearch = true,
  maxHeight = '400px',
  className,
}: CategoryTreeNavigationProps) {
  const { tree, searchCategories, isLoading, error, stats } = useCategoriesTree();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CategoryTreeItem[]>([]);

  // Toggle expandir/colapsar
  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Selecionar categoria
  const handleSelect = useCallback(
    (category: CategoryNode | CategoryTreeItem) => {
      onSelectCategory?.(category);
    },
    [onSelectCategory],
  );

  // Buscar
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.trim()) {
        setSearchResults(searchCategories(query));
      } else {
        setSearchResults([]);
      }
    },
    [searchCategories],
  );

  // Limpar busca
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Expandir todos
  const expandAll = useCallback(() => {
    const allIds = new Set<string>();
    const addIds = (nodes: CategoryNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          allIds.add(node.id);
          addIds(node.children);
        }
      });
    };
    addIds(tree);
    setExpandedIds(allIds);
  }, [tree]);

  // Colapsar todos
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-2 p-4', className)}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('p-4 text-center text-destructive', className)}>
        <p className="text-sm">Erro ao carregar categorias</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  // Empty state
  if (tree.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <Folder className="mx-auto mb-2 h-12 w-12 opacity-50" />
        <p className="text-sm">Nenhuma categoria encontrada</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header com busca */}
      {showSearch && (
        <div className="space-y-2 border-b p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar categoria..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8 pr-8"
            />
            {searchQuery && (
              <button
                aria-label="Fechar"
                onClick={clearSearch}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {stats.total} categorias em {stats.levels} níveis
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={expandAll}>
                Expandir
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={collapseAll}>
                Colapsar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <ScrollArea style={{ maxHeight }}>
        <div className="p-2">
          {/* Resultados de busca */}
          {searchQuery && searchResults.length > 0 ? (
            <div className="space-y-1">
              <p className="mb-2 px-2 text-xs text-muted-foreground">
                {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map((cat) => (
                <SearchResult
                  key={cat.id}
                  category={cat}
                  isSelected={selectedCategoryId === cat.id}
                  onSelect={() => handleSelect(cat)}
                />
              ))}
            </div>
          ) : searchQuery && searchResults.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">Nenhuma categoria encontrada</p>
              <p className="text-xs">Tente outra busca</p>
            </div>
          ) : (
            /* Árvore de categorias */
            tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                level={0}
                selectedId={selectedCategoryId || null}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                onSelect={handleSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default CategoryTreeNavigation;

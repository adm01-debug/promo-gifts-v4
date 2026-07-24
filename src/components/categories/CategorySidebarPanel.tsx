import { useState, useCallback, type MouseEvent } from 'react';
import { ChevronRight, Folder, X, ChevronLeft, Layers } from 'lucide-react';
import { useCategoriesTree, type CategoryNode, type CategoryTreeItem } from '@/hooks/products';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toTitleCase } from '@/lib/textUtils';
import { m as motion, AnimatePresence } from 'framer-motion';

interface CategorySidebarPanelProps {
  onSelectCategory?: (categoryId: string | null, categoryName?: string) => void;
  selectedCategoryId?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

// Componente de nó da árvore com animação
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
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  // Handler de clique com propagação correta
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    // Sempre seleciona
    onSelect(node);

    // Se tem filhos, expande/colapsa
    if (hasChildren) {
      onToggle(node.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition-all duration-200',
          'hover:bg-accent/60',
          isSelected && 'border-l-2 border-primary bg-primary/15 font-semibold text-primary',
        )}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={handleClick}
      >
        {/* Indicador de expansão integrado (seta) - apenas para itens com filhos */}
        {hasChildren ? (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-muted-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </motion.div>
        ) : (
          /* Bullet colorido para subcategorias (itens folha) */
          <div className="flex h-4 w-4 items-center justify-center">
            <motion.div
              className={cn(
                'h-2 w-2 rounded-full transition-all duration-200',
                isSelected ? 'scale-110 bg-primary' : 'bg-primary/50 hover:bg-primary/70',
              )}
              animate={{ scale: isSelected ? 1.2 : 1 }}
              transition={{ duration: 0.2 }}
            />
          </div>
        )}

        {/* Emoji da categoria (apenas para raiz com emoji) */}
        {node.icon && <span className="text-base">{node.icon}</span>}

        {/* Nome da categoria em Title Case */}
        <span className="flex-1 truncate text-sm">{toTitleCase(node.name)}</span>

        {/* Badge com contagem de filhos */}
        {hasChildren && (
          <Badge
            variant={isSelected ? 'default' : 'outline'}
            className="ml-auto h-5 px-1.5 py-0 text-[10px] opacity-60"
          >
            {node.children.length}
          </Badge>
        )}
      </div>

      {/* Filhos com animação */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function CategorySidebarPanel({
  onSelectCategory,
  selectedCategoryId,
  isCollapsed = false,
  onToggleCollapse,
  className,
}: CategorySidebarPanelProps) {
  const { tree, searchCategories, isLoading, error, stats, getPath } = useCategoriesTree();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CategoryTreeItem[]>([]);

  // Obter breadcrumb da categoria selecionada
  const selectedBreadcrumb = selectedCategoryId ? getPath(selectedCategoryId) : [];

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
      onSelectCategory?.(category.id, category.name);

      // Auto-expandir apenas os PAIS (não o nó selecionado)
      // Motivo: quando o usuário clica no próprio nó, o TreeNode também chama toggle;
      // se adicionarmos o nó aqui, o toggle seguinte acaba "desfazendo" a expansão.
      if ('parent_id' in category && category.parent_id) {
        const path = getPath(category.id);
        setExpandedIds((prev) => {
          const next = new Set(prev);
          path.slice(0, -1).forEach((p) => next.add(p.id));
          return next;
        });
      }
    },
    [onSelectCategory, getPath],
  );

  // Limpar seleção
  const handleClearSelection = useCallback(() => {
    onSelectCategory?.(null);
    setSearchQuery('');
    setSearchResults([]);
  }, [onSelectCategory]);

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

  // Versão colapsada
  if (isCollapsed) {
    return (
      <div className={cn('flex w-12 flex-col items-center gap-2 border-r bg-card py-4', className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8"
          aria-label="Avançar"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Separator className="w-8" />
        <div className="flex flex-col items-center gap-1">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">{stats.total}</span>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('w-64 space-y-3 border-r bg-card p-4', className)}>
        <Skeleton className="h-8 w-full" />
        <Separator />
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="ml-4 h-6 w-3/4" />
          <Skeleton className="ml-4 h-6 w-3/4" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="ml-4 h-6 w-3/4" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('w-64 border-r bg-card p-4', className)}>
        <div className="text-center text-destructive">
          <Folder className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm font-medium">Erro ao carregar</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('flex h-full flex-col border-r bg-card', className)}
    >
      {/* Header */}
      <div className="space-y-3 border-b p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="font-display text-sm font-semibold">Categorias</h3>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px]">
              {stats.total}
            </Badge>
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className="h-7 w-7"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <Input
          placeholder="Buscar categoria..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-8 text-sm"
        />

        {/* Quick actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={expandAll}>
              Expandir
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={collapseAll}
            >
              Colapsar
            </Button>
          </div>
          {selectedCategoryId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
              onClick={handleClearSelection}
            >
              <X className="mr-1 h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Breadcrumb da seleção */}
      {selectedBreadcrumb.length > 0 && (
        <div className="border-b bg-primary/5 px-3 py-2">
          <p className="mb-1 text-[10px] text-muted-foreground">Selecionado:</p>
          <div className="flex flex-wrap items-center gap-1">
            {selectedBreadcrumb.map((cat, i) => (
              <span key={cat.id} className="flex items-center text-xs">
                <span
                  className={cn(
                    'max-w-[80px] truncate',
                    i === selectedBreadcrumb.length - 1 && 'font-semibold text-primary',
                  )}
                >
                  {cat.name}
                </span>
                {i < selectedBreadcrumb.length - 1 && (
                  <ChevronRight className="mx-0.5 h-3 w-3 text-muted-foreground" />
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tree content */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Resultados de busca */}
          {searchQuery && searchResults.length > 0 ? (
            <div className="px-2">
              <p className="mb-2 px-2 text-[10px] text-muted-foreground">
                {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map((cat) => (
                <div
                  key={cat.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2',
                    'transition-colors hover:bg-accent/60',
                    selectedCategoryId === cat.id && 'bg-primary/15 text-primary',
                  )}
                  onClick={() => handleSelect(cat)}
                >
                  <Folder className="h-4 w-4 flex-shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{cat.name}</p>
                    {cat.tree_structure && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {cat.tree_structure}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery && searchResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Folder className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhuma categoria</p>
              <p className="text-[10px]">Tente outra busca</p>
            </div>
          ) : tree.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Folder className="mx-auto mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma categoria</p>
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

      {/* Footer stats */}
      <div className="border-t bg-muted/30 p-2">
        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <span>{stats.levels} níveis</span>
          <span>•</span>
          <span>{stats.roots} raízes</span>
        </div>
      </div>
    </motion.div>
  );
}

export default CategorySidebarPanel;

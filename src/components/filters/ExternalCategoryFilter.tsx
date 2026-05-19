import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, X, Layers, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCategoryIcon, useCategoryIcons, useExternalCategoriesQuery, type ExternalCategory } from "@/hooks/products";

interface ExternalCategoryFilterProps {
  selectedCategories: string[]; // UUIDs
  onCategoriesChange: (categories: string[]) => void;
  compact?: boolean;
}

interface CategoryNode extends ExternalCategory {
  children: CategoryNode[];
}

import { toTitleCase } from "@/lib/textUtils";

export function ExternalCategoryFilter({
  selectedCategories,
  onCategoriesChange,
  compact = false,
}: ExternalCategoryFilterProps) {
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  const { data: categoryIcons = [] } = useCategoryIcons();
  const { data: categories = [], isLoading, refetch, isFetching } = useExternalCategoriesQuery();

  // Construir árvore hierárquica
  const categoryTree = useMemo((): CategoryNode[] => {
    if (!categories?.length) return [];

    const categoryMap = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];

    // Primeiro passo: criar todos os nós
    categories.forEach((cat) => {
      categoryMap.set(cat.id, {
        ...cat,
        children: [],
      });
    });

    // Segundo passo: construir a árvore
    categoryMap.forEach((cat) => {
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children.push(cat);
        } else {
          // Se o pai não existe, tratar como raiz
          roots.push(cat);
        }
      } else {
        roots.push(cat);
      }
    });

    // Ordenar por nome
    const sortByName = (a: CategoryNode, b: CategoryNode) => a.name.localeCompare(b.name);
    roots.sort(sortByName);
    categoryMap.forEach((cat) => cat.children.sort(sortByName));

    return roots;
  }, [categories]);

  // Filtrar por busca
  const filteredTree = useMemo(() => {
    if (!search.trim()) return categoryTree;

    const searchLower = search.toLowerCase();

    const filterNode = (node: CategoryNode): CategoryNode | null => {
      const matchesSearch = node.name.toLowerCase().includes(searchLower);
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is CategoryNode => n !== null);

      if (matchesSearch || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return categoryTree
      .map(filterNode)
      .filter((n): n is CategoryNode => n !== null);
  }, [categoryTree, search]);

  const toggleCategory = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoriesChange(selectedCategories.filter((id) => id !== categoryId));
    } else {
      onCategoriesChange([...selectedCategories, categoryId]);
    }
  };

  const toggleExpand = (categoryId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const clearAll = () => {
    onCategoriesChange([]);
  };

  // Renderizar nó da categoria
  // Calcular contagem total (própria + descendentes)
  const getTotalCount = (node: CategoryNode): number => {
    const own = node.products_count ?? 0;
    return own + node.children.reduce((sum, child) => sum + getTotalCount(child), 0);
  };

  const renderCategoryNode = (node: CategoryNode, level: number = 0): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedCategories.includes(node.id);
    const icon = getCategoryIcon(node.name, categoryIcons);
    const totalCount = getTotalCount(node);

    return (
      <div key={node.id} className="select-none">
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors",
            isSelected
              ? "bg-orange/10 ring-1 ring-inset ring-orange/20"
              : "hover:bg-muted/50"
          )}
          style={{ paddingLeft: `${8 + level * 16}px` }}
        >
          {/* Botão de expandir */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(node.id)}
              className={cn(
                "p-0.5 rounded transition-colors",
                isSelected ? "hover:bg-orange/10" : "hover:bg-muted"
              )}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {/* Checkbox */}
          <Checkbox
            id={`ext-cat-${node.id}`}
            checked={isSelected}
            onCheckedChange={() => toggleCategory(node.id)}
            className="h-4 w-4 rounded-full border-orange/60 data-[state=checked]:border-orange data-[state=checked]:bg-orange data-[state=checked]:text-orange-foreground"
          />

          {/* Label */}
          <Label
            htmlFor={`ext-cat-${node.id}`}
            className="flex-1 text-sm cursor-pointer flex items-center gap-1.5 min-w-0"
          >
            <span className="flex-shrink-0">{icon}</span>
            <span className="truncate">{toTitleCase(node.name)}</span>
          </Label>

          {/* Badge de contagem */}
          {totalCount > 0 && (
            <span
              className={cn(
                "flex-shrink-0 text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-full",
                isSelected
                  ? "bg-orange/20 text-orange"
                  : "bg-muted text-muted-foreground"
              )}
              title={`${totalCount} produtos${hasChildren ? ` (${node.products_count ?? 0} diretos)` : ''}`}
            >
              {totalCount >= 1000 ? `${(totalCount / 1000).toFixed(1)}k` : totalCount}
            </span>
          )}
        </div>

        {/* Filhos */}
        {hasChildren && isExpanded && (
          <div className="ml-2">
            {node.children.map((child) => renderCategoryNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-5/6" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Categorias selecionadas */}
      {selectedCategories.length > 0 && (
        <div className="p-2 bg-orange/5 rounded-lg border border-orange/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-orange flex items-center gap-1.5">
              <Layers className="h-3 w-3" />
              Selecionadas ({selectedCategories.length})
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Limpar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedCategories.slice(0, 5).map((catId) => {
              const cat = categories.find((c) => c.id === catId);
              return cat ? (
                <Badge
                  key={catId}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-destructive/20"
                  onClick={() => toggleCategory(catId)}
                >
                  {toTitleCase(cat.name)}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ) : null;
            })}
            {selectedCategories.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{selectedCategories.length - 5} mais
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm pl-8 pr-8"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Estatísticas */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <span>{categories.length} categorias</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            title="Atualizar categorias"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            {isFetching ? "Atualizando..." : "Atualizar"}
          </button>
          <span className="text-orange font-medium">
            {selectedCategories.length} selecionadas
          </span>
        </div>
      </div>

      {/* Árvore de categorias */}
      <div 
        className={cn("pr-2 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent", compact ? "max-h-52" : "max-h-[55vh]")}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="space-y-0.5">
          {filteredTree.length > 0 ? (
            filteredTree.map((node) => renderCategoryNode(node))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              {search ? "Nenhuma categoria encontrada" : "Nenhuma categoria disponível"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

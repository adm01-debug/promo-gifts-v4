/**
 * StockCategoryTreeSelect — Compact hierarchical category selector for stock filters.
 * Uses useCategoriesTree to show full tree with expand/collapse.
 */
import { useState, useMemo } from "react";
import { ChevronRight, FolderTree, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCategoriesTree, type CategoryNode } from "@/hooks/products";
import { motion } from "framer-motion";

interface StockCategoryTreeSelectProps {
  value: string | undefined;
  onChange: (categoryId: string | undefined, categoryName?: string) => void;
  productCountMap?: Map<string, number>;
}

function TreeNodeItem({
  node,
  level,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
  searchTerm,
}: {
  node: CategoryNode;
  level: number;
  selectedId: string | undefined;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: CategoryNode) => void;
  searchTerm: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  // When searching, show all matching nodes
  const matchesSearch = searchTerm
    ? node.name.toLowerCase().includes(searchTerm.toLowerCase())
    : true;

  const childrenMatch = searchTerm
    ? node.children?.some(c => nodeOrDescendantsMatch(c, searchTerm))
    : false;

  if (searchTerm && !matchesSearch && !childrenMatch) return null;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1.5 px-2 rounded cursor-pointer transition-all text-xs",
          "hover:bg-accent/60",
          isSelected && "bg-primary/15 text-primary font-semibold"
        )}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
          if (hasChildren) onToggle(node.id);
        }}
      >
        {hasChildren ? (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-muted-foreground shrink-0"
          >
            <ChevronRight className="w-3 h-3" />
          </motion.div>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {node.icon && <span className="text-xs shrink-0">{node.icon}</span>}

        <span className="truncate flex-1">{node.name}</span>
      </div>

      {hasChildren && (isExpanded || (searchTerm && childrenMatch)) && (
        <div>
          {node.children.map(child => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function nodeOrDescendantsMatch(node: CategoryNode, term: string): boolean {
  if (node.name.toLowerCase().includes(term.toLowerCase())) return true;
  return node.children?.some(c => nodeOrDescendantsMatch(c, term)) || false;
}

export function StockCategoryTreeSelect({ value, onChange }: StockCategoryTreeSelectProps) {
  const { tree, isLoading, categories } = useCategoriesTree();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const selectedName = useMemo(() => {
    if (!value) return null;
    const cat = categories.find(c => c.id === value || c.name === value);
    return cat?.name || value;
  }, [value, categories]);

  const handleToggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (node: CategoryNode) => {
    if (value === node.id || value === node.name) {
      onChange(undefined);
    } else {
      onChange(node.name, node.name);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Selected indicator */}
      {selectedName && (
        <div className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary rounded px-2 py-1">
          <FolderTree className="h-3 w-3 shrink-0" />
          <span className="truncate flex-1">{selectedName}</span>
          <button onClick={() => onChange(undefined)} className="hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Buscar categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs pl-7 pr-6"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="h-52 overflow-y-auto border border-border/40 rounded-md scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
        <div className="space-y-0.5">
          {/* "Todas" option */}
          <div
            className={cn(
              "flex items-center gap-1.5 py-1.5 px-2 rounded cursor-pointer transition-all text-xs",
              "hover:bg-accent/60",
              !value && "bg-primary/15 text-primary font-semibold"
            )}
            onClick={() => onChange(undefined)}
          >
            <FolderTree className="h-3 w-3 shrink-0" />
            <span>Todas as categorias</span>
          </div>

          {tree.map(node => (
            <TreeNodeItem
              key={node.id}
              node={node}
              level={0}
              selectedId={value}
              expandedIds={expandedIds}
              onToggle={handleToggle}
              onSelect={handleSelect}
              searchTerm={search}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

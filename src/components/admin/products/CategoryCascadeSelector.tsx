/**
 * CategoryCascadeSelector — Seleção de categoria com cascata de 2+ níveis,
 * breadcrumb persistente e navegação em árvore via dialog.
 */
import { useMemo, useState } from 'react';
import { useExternalCategoriesQuery, type ExternalCategory } from '@/hooks/products';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Check,
  Search,
  TreePine,
  X,
  Layers,
  FolderTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NewCategoryDialog } from './NewCategoryDialog';

interface CategoryCascadeSelectorProps {
  value: string;
  onChange: (id: string) => void;
  error?: string;
}

interface CatNode extends ExternalCategory {
  children: CatNode[];
  fullPath: string[];
}

function buildTree(categories: ExternalCategory[]): {
  roots: CatNode[];
  nodeMap: Map<string, CatNode>;
} {
  const map = new Map<string, CatNode>();
  const roots: CatNode[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [], fullPath: [] });
  }
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function setPaths(node: CatNode, ancestors: string[]) {
    node.fullPath = [...ancestors, node.name];
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of node.children) setPaths(child, node.fullPath);
  }
  roots.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of roots) setPaths(r, []);

  return { roots, nodeMap: map };
}

// ─── Cascade Selects ───────────────────────────
function CascadeSelects({
  roots,
  nodeMap,
  value,
  onChange,
}: {
  roots: CatNode[];
  nodeMap: Map<string, CatNode>;
  value: string;
  onChange: (id: string) => void;
}) {
  const selectedChain = useMemo(() => {
    if (!value) return [];
    const chain: string[] = [];
    let current = nodeMap.get(value);
    while (current) {
      chain.unshift(current.id);
      current = current.parent_id ? nodeMap.get(current.parent_id) : undefined;
    }
    return chain;
  }, [value, nodeMap]);

  const levels = useMemo(() => {
    const result: { items: CatNode[]; selectedId: string }[] = [];
    result.push({ items: roots, selectedId: selectedChain[0] ?? '' });
    for (let i = 0; i < selectedChain.length; i++) {
      const node = nodeMap.get(selectedChain[i]);
      if (node?.children?.length) {
        result.push({ items: node.children, selectedId: selectedChain[i + 1] ?? '' });
      }
    }
    return result;
  }, [roots, nodeMap, selectedChain]);

  const handleChange = (levelIndex: number, newId: string) => {
    onChange(newId);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {levels.map((level, i) => (
        <div key={i} className="flex min-w-0 items-center gap-2">
          {i > 0 && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/50">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
          <Select value={level.selectedId || undefined} onValueChange={(v) => handleChange(i, v)}>
            <SelectTrigger
              className={cn(
                'h-9 min-w-[160px] max-w-[220px] rounded-lg border-border/60 text-xs',
                'bg-background/50 transition-all duration-200 hover:bg-accent/30',
                level.selectedId && 'border-primary/30 bg-primary/5',
              )}
            >
              <div className="flex items-center gap-1.5">
                <Folder
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    level.selectedId ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <SelectValue placeholder={i === 0 ? 'Categoria raiz...' : 'Subcategoria...'} />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-[280px]">
              {level.items.map((item) => (
                <SelectItem key={item.id} value={item.id} className="py-2 text-xs">
                  <span className="flex items-center gap-2">
                    {item.children.length > 0 ? (
                      <Folder className="h-3.5 w-3.5 text-primary/60" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-border/50" />
                    )}
                    <span className="flex-1">{item.name}</span>
                    {item.children.length > 0 && (
                      <span className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {item.children.length}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

// ─── Tree Dialog ───────────────────────────────
function TreeNode({
  node,
  selectedId,
  onSelect,
  depth,
}: {
  node: CatNode;
  selectedId: string;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(() => {
    if (node.id === selectedId) return true;
    const checkDescendant = (n: CatNode): boolean =>
      n.id === selectedId || n.children.some(checkDescendant);
    return checkDescendant(node);
  });

  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <div>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-all duration-150',
          'hover:bg-accent/50',
          isSelected && 'bg-primary/10 font-medium text-primary ring-1 ring-primary/20',
        )}
        style={{ paddingLeft: `${depth * 20 + 10}px` }}
        onClick={() => {
          onSelect(node.id);
          if (hasChildren) setExpanded((prev) => !prev);
        }}
      >
        {hasChildren ? (
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
              expanded && 'rotate-90',
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {hasChildren ? (
          expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-primary/70" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-primary/70" />
          )
        ) : (
          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30">
            {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
        )}
        <span className="flex-1 truncate">{node.name}</span>
        {isSelected && hasChildren && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </button>
      {expanded && hasChildren && (
        <div className="relative">
          <div
            className="absolute bottom-0 left-0 top-0 border-l border-border/30"
            style={{ marginLeft: `${depth * 20 + 18}px` }}
          />
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryTreeDialog({
  roots,
  nodeMap,
  value,
  onChange,
}: {
  roots: CatNode[];
  nodeMap: Map<string, CatNode>;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredRoots = useMemo(() => {
    if (!search) return roots;
    const q = search.toLowerCase();
    const matchIds = new Set<string>();
    for (const node of nodeMap.values()) {
      if (node.name.toLowerCase().includes(q)) {
        let current: CatNode | undefined = node;
        while (current) {
          matchIds.add(current.id);
          current = current.parent_id ? nodeMap.get(current.parent_id) : undefined;
        }
      }
    }
    if (matchIds.size === 0) return [];
    function filterNode(node: CatNode): CatNode | null {
      if (!matchIds.has(node.id)) return null;
      return { ...node, children: node.children.map(filterNode).filter(Boolean) as CatNode[] };
    }
    return roots.map(filterNode).filter(Boolean) as CatNode[];
  }, [roots, nodeMap, search]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch('');
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 rounded-lg border-border/60 text-xs transition-all duration-200 hover:border-primary/30 hover:bg-primary/5"
        >
          <TreePine className="h-3.5 w-3.5" />
          Árvore
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderTree className="h-5 w-5 text-primary" />
            Navegar por Árvore de Categorias
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-lg pl-9 text-sm"
          />
        </div>
        <ScrollArea className="-mx-2 h-[360px]">
          <div className="px-2 py-1">
            {filteredRoots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Tente outro termo de busca</p>
              </div>
            ) : (
              filteredRoots.map((root) => (
                <TreeNode
                  key={root.id}
                  node={root}
                  selectedId={value}
                  onSelect={handleSelect}
                  depth={0}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────
export function CategoryCascadeSelector({ value, onChange, error }: CategoryCascadeSelectorProps) {
  const { data: categories = [], isLoading } = useExternalCategoriesQuery();

  const { roots, nodeMap } = useMemo(() => buildTree(categories), [categories]);

  const selectedNode = value ? nodeMap.get(value) : undefined;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-9 animate-pulse rounded-lg bg-muted/20" />
        <div className="h-5 w-48 animate-pulse rounded bg-muted/15" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Row: Cascade selects + Tree button + New */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CascadeSelects roots={roots} nodeMap={nodeMap} value={value} onChange={onChange} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CategoryTreeDialog roots={roots} nodeMap={nodeMap} value={value} onChange={onChange} />
          <NewCategoryDialog onCreated={onChange} />
        </div>
      </div>

      {/* Breadcrumb - Elegant path display */}
      {selectedNode ? (
        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
          <Layers className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {selectedNode.fullPath.map((segment, i) => {
            const isLast = i === selectedNode.fullPath.length - 1;
            return (
              <span key={i} className="flex items-center gap-0.5">
                {i > 0 && <ChevronRight className="mx-0.5 h-3 w-3 text-muted-foreground/40" />}
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs transition-colors',
                    isLast
                      ? 'border border-primary/20 bg-primary/15 font-medium text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {segment}
                </span>
              </span>
            );
          })}
          <button
            type="button"
            className="group ml-2 rounded-md p-1 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onChange('')}
            title="Limpar seleção"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-destructive" />
          </button>
        </div>
      ) : (
        /* Empty state */
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/40 bg-muted/10 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/30">
            <FolderTree className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nenhuma categoria selecionada</p>
            <p className="text-[11px] text-muted-foreground/50">
              Selecione uma categoria acima ou navegue pela árvore
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <span className="h-1 w-1 shrink-0 rounded-full bg-destructive" />
          {error}
        </p>
      )}
    </div>
  );
}

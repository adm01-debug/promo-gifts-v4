/**
 * CollectionTableView — Table view for local collections with sorting.
 */
import { useState, useMemo } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  MoreVertical,
  Pencil,
  Copy,
  Star,
  Trash2,
  Package,
  Clock,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Collection } from '@/hooks/collections';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';

type SortKey = 'name' | 'products' | 'featured' | 'updated';
type SortDir = 'asc' | 'desc';

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentKey === sortKey;
  return (
    <th
      className={cn(
        'cursor-pointer select-none px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          currentDir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </th>
  );
}

interface CollectionTableRowProps {
  collection: Collection;
  products: Array<{
    id: string;
    name: string;
    image_url?: string | null;
    sku?: string;
    price?: number | null;
  }>;
  isSelected: boolean;
  isSelectionMode: boolean;
  onToggleSelect: () => void;
  onNavigate: () => void;
  onEdit: () => void;
  onClone: () => void;
  onToggleFeatured: () => void;
  onDelete: () => void;
  updatedAgo?: string | null;
  index: number;
}

function CollectionTableRow({
  collection,
  products,
  isSelected,
  isSelectionMode: _isSelectionMode,
  onToggleSelect,
  onNavigate,
  onEdit,
  onClone,
  onToggleFeatured,
  onDelete,
  updatedAgo,
  index,
}: CollectionTableRowProps) {
  const previewImage = products[0]?.image_url;
  const iconChar = collection.icon || '📁';
  const iconColor =
    (collection as unknown as { iconColor?: string }).iconColor || collection.color || '#6366f1';

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        'group cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/30',
        isSelected && 'bg-primary/5',
      )}
      onClick={onNavigate}
    >
      <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <SelectionCheckbox checked={isSelected} onChange={onToggleSelect} size="sm" />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {previewImage ? (
            <OptimizedImage
              src={getCdnUrl(previewImage, 'thumbnail')}
              alt=""
              className="rounded object-cover"
              containerClassName="h-8 w-8 shrink-0"
            />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-sm"
              style={{ backgroundColor: `${iconColor}20`, color: iconColor }}
            >
              {iconChar}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{collection.name}</p>
            {collection.description && (
              <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                {collection.description}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        <Badge variant="secondary" className="gap-1 text-xs">
          <Package className="h-3 w-3" />
          {collection.productIds.length}
        </Badge>
      </td>
      <td className="px-3 py-2.5 text-center">
        {collection.isFeatured && (
          <Star className="mx-auto h-4 w-4 fill-amber-500 text-amber-500" />
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
        {updatedAgo && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {updatedAgo}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onClone}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleFeatured}>
              <Star className="mr-2 h-3.5 w-3.5" />
              {collection.isFeatured ? 'Remover destaque' : 'Destacar'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </motion.tr>
  );
}

interface CollectionTableViewProps {
  collections: Collection[];
  getCollectionProducts: (id: string) => unknown[];
  selectedCollectionIds: Set<string>;
  isSelectionMode: boolean;
  onToggleSelect: (id: string) => void;
  onNavigate: (id: string) => void;
  onEdit: (collection: Collection) => void;
  onClone: (collection: Collection) => void;
  onToggleFeatured: (collection: Collection) => void;
  onDelete: (id: string) => void;
  relativeTime: (dateStr: string | undefined) => string | null;
}

export function CollectionTableView({
  collections,
  getCollectionProducts,
  selectedCollectionIds,
  isSelectionMode,
  onToggleSelect,
  onNavigate,
  onEdit,
  onClone,
  onToggleFeatured,
  onDelete,
  relativeTime,
}: CollectionTableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return collections;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...collections].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name, 'pt-BR');
        case 'products':
          return dir * (a.productIds.length - b.productIds.length);
        case 'featured':
          return dir * ((a.isFeatured ? 1 : 0) - (b.isFeatured ? 1 : 0));
        case 'updated':
          return dir * (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '');
        default:
          return 0;
      }
    });
  }, [collections, sortKey, sortDir]);

  return (
    <div className="space-y-2">
      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border/50">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="w-10 px-3 py-2" />
              <SortHeader
                label="Coleção"
                sortKey="name"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="Produtos"
                sortKey="products"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                className="text-center"
              />
              <SortHeader
                label="Destaque"
                sortKey="featured"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                className="text-center"
              />
              <SortHeader
                label="Atualizado"
                sortKey="updated"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {sorted.length > 0 ? (
                sorted.map((collection, idx) => (
                  <CollectionTableRow
                    key={collection.id}
                    collection={collection}
                    products={
                      getCollectionProducts(collection.id) as Array<{
                        id: string;
                        name: string;
                        image_url?: string | null;
                        sku?: string;
                        price?: number | null;
                      }>
                    }
                    isSelected={selectedCollectionIds.has(collection.id)}
                    isSelectionMode={isSelectionMode}
                    onToggleSelect={() => onToggleSelect(collection.id)}
                    onNavigate={() => onNavigate(collection.id)}
                    onEdit={() => onEdit(collection)}
                    onClone={() => onClone(collection)}
                    onToggleFeatured={() => onToggleFeatured(collection)}
                    onDelete={() => onDelete(collection.id)}
                    updatedAgo={relativeTime(collection.updatedAt)}
                    index={idx}
                  />
                ))
              ) : (
                <motion.tr key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td colSpan={6} className="px-3 py-8 text-center">
                    <Filter className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma coleção encontrada com os filtros atuais
                    </p>
                  </td>
                </motion.tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}

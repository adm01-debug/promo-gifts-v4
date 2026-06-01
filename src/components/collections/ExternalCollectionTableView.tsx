/**
 * ExternalCollectionTableView — Table view for catalog (external) collections with sorting.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Package, Copy, ArrowUp, ArrowDown, ArrowUpDown, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExternalCollection } from '@/hooks/collections';

type SortKey = 'name' | 'products';
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

interface ExternalCollectionTableViewProps {
  collections: ExternalCollection[];
  productCounts?: Map<string, number>;
  onNavigate: (id: string) => void;
  onDuplicate: (collection: ExternalCollection) => void;
}

export function ExternalCollectionTableView({
  collections,
  productCounts,
  onNavigate,
  onDuplicate,
}: ExternalCollectionTableViewProps) {
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
        case 'products': {
          const ca = productCounts?.get(a.id) ?? 0;
          const cb = productCounts?.get(b.id) ?? 0;
          return dir * (ca - cb);
        }
        default:
          return 0;
      }
    });
  }, [collections, sortKey, sortDir, productCounts]);

  return (
    <div className="space-y-2">
      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border/50">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
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
              <th className="w-20 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {sorted.length > 0 ? (
                sorted.map((collection, idx) => {
                  const count = productCounts?.get(collection.id);
                  return (
                    <motion.tr
                      key={collection.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/30"
                      onClick={() => onNavigate(collection.id)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded text-sm"
                            style={{
                              backgroundColor: collection.color
                                ? `${collection.color}20`
                                : 'hsl(var(--muted))',
                            }}
                          >
                            {collection.image_url ? (
                              <img
                                src={collection.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {collection.name}
                            </p>
                            {collection.description && (
                              <p className="max-w-[250px] truncate text-xs text-muted-foreground">
                                {collection.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Package className="h-3 w-3" />
                          {count ?? '—'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => onDuplicate(collection)}
                        >
                          <Copy className="h-3 w-3" />
                          Duplicar
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <motion.tr key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td colSpan={3} className="px-3 py-8 text-center">
                    <Filter className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhuma coleção encontrada</p>
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

/**
 * ExternalCollectionCard — Grid/List card for catalog (external) collections.
 * Extracted from CollectionsPage for modularity.
 */
import { motion } from 'framer-motion';
import { FolderOpen, Package, Star, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ExternalCollection } from '@/hooks/collections';

interface ExternalCollectionCardProps {
  collection: ExternalCollection;
  productCount: number | undefined;
  viewMode: 'grid' | 'list';
  onNavigate: () => void;
  onDuplicate: () => void;
  index: number;
}

export function ExternalCollectionCard({
  collection,
  productCount,
  viewMode,
  onNavigate,
  onDuplicate,
  index,
}: ExternalCollectionCardProps) {
  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
        className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border/50 bg-card p-3 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
        onClick={onNavigate}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg text-lg"
          style={{
            backgroundColor: collection.color ? `${collection.color}20` : 'hsl(var(--muted))',
          }}
        >
          {collection.image_url ? (
            <img src={collection.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <FolderOpen
              className="h-6 w-6"
              style={{ color: collection.color || 'hsl(var(--primary))' }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display font-semibold text-foreground">{collection.name}</h3>
          {collection.description && (
            <p className="truncate text-sm text-muted-foreground">{collection.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Package className="h-3 w-3" />
            {productCount ?? '…'}
          </span>
          {collection.is_featured && <Star className="h-4 w-4 text-primary" />}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            aria-label="Duplicar coleção"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border-[1.5px] border-border/40 bg-card shadow-sm transition-all duration-500 hover:border-primary/40"
      onClick={onNavigate}
    >
      <div
        className="relative flex aspect-[3/4] items-center justify-center overflow-hidden"
        style={{
          backgroundColor: collection.color ? `${collection.color}12` : 'hsl(var(--muted))',
        }}
      >
        {collection.image_url ? (
          <img
            src={collection.image_url}
            alt={collection.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FolderOpen
              className="h-14 w-14 transition-transform duration-300 group-hover:scale-110"
              style={{ color: collection.color || 'hsl(var(--primary))' }}
            />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card/80 to-transparent" />
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg shadow-md"
            style={{
              backgroundColor: collection.color || 'hsl(var(--primary))',
              color: '#fff',
            }}
          >
            {collection.icon || '📁'}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-display text-base font-bold leading-tight text-foreground">
              {collection.name}
            </h3>
            {collection.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {collection.description}
              </p>
            )}
          </div>
          {collection.is_featured && (
            <Star className="h-4 w-4 shrink-0 fill-primary text-primary" />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Package className="h-3 w-3 text-primary" />
            {productCount ?? '…'} produtos
          </span>
          {collection.is_featured && (
            <Badge
              variant="secondary"
              className="border-primary/20 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
            >
              Destaque
            </Badge>
          )}
        </div>
      </div>

      <div className="absolute right-3 top-3 z-10 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Duplicar como coleção local"
          className="h-8 w-8 bg-background/60 backdrop-blur-sm hover:bg-background/80"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

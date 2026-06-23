/**
 * CollectionListItem — Premium list view row for local collections.
 * Extracted from CollectionsPage for maintainability.
 */
import { m as motion } from 'framer-motion';
import { MoreVertical, Pencil, Copy, Star, Trash2, Package, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Collection } from '@/hooks/collections';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';
import { getProxiedImageUrl } from '@/utils/imageProxy';

interface CollectionListItemProps {
  collection: Collection;
  previewImage?: string;
  isSelected: boolean;
  onToggleSelect: () => void;
  onNavigate: () => void;
  onEdit: () => void;
  onClone: () => void;
  onToggleFeatured: () => void;
  onDelete: () => void;
  updatedAgo?: string | null;
  index: number;
}

export function CollectionListItem({
  collection,
  previewImage,
  isSelected,
  onToggleSelect,
  onNavigate,
  onEdit,
  onClone,
  onToggleFeatured,
  onDelete,
  updatedAgo,
  index,
}: CollectionListItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        'group flex cursor-pointer items-center gap-4 rounded-xl border bg-card p-3 transition-all duration-200',
        isSelected
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
          : 'border-border/50 hover:border-primary/40 hover:shadow-md',
      )}
      onClick={onNavigate}
    >
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <SelectionCheckbox checked={isSelected} onChange={onToggleSelect} size="md" />
      </div>
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg text-lg"
        style={{ backgroundColor: `${collection.color}20` }}
      >
        {previewImage ? (
          <OptimizedImage
            src={getCdnUrl(previewImage, 'thumbnail')}
            urlOriginal={getProxiedImageUrl(previewImage) ?? null}
            alt=""
            className="object-cover"
            containerClassName="h-full w-full"
          />
        ) : (
          <span>{collection.icon}</span>
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
          {collection.productIds.length}
        </span>
        {collection.isFeatured && <Star className="h-4 w-4 text-primary" />}
        {updatedAgo && (
          <span className="hidden items-center gap-0.5 text-xs text-muted-foreground/60 md:flex">
            <Clock className="h-2.5 w-2.5" />
            {updatedAgo}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mais opções"
              className="h-8 w-8 bg-background/60 backdrop-blur-sm transition-opacity hover:bg-background/80 sm:opacity-0 sm:group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onClone();
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onToggleFeatured();
              }}
            >
              <Star className="mr-2 h-4 w-4" />
              {collection.isFeatured ? 'Remover destaque' : 'Destacar'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

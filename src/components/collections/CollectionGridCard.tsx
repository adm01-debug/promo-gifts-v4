/**
 * CollectionGridCard — Premium card with dynamic diagonal collage layout.
 * Inspired by editorial photo grids with angular cuts.
 */
import { m as motion } from 'framer-motion';
import {
  FolderOpen,
  MoreVertical,
  Pencil,
  Copy,
  Star,
  Trash2,
  Package,
  Clock,
  ArrowUpRight,
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
import { cn } from '@/lib/utils';
import type { Collection } from '@/hooks/collections';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';

interface CollectionGridCardProps {
  collection: Collection;
  products: { images: string[] }[];
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

/* ── Dynamic Collage — simple grid, no clip-path ── */
function DynamicCollage({ images }: { images: string[] }) {
  const count = images.length;
  const imgClass =
    'object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]';

  if (count === 1) {
    return (
      <div className="absolute inset-0">
        <OptimizedImage
          src={getCdnUrl(images[0], 'card')}
          alt=""
          className={imgClass}
          containerClassName="h-full w-full"
        />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-0">
        <div className="overflow-hidden">
          <OptimizedImage
            src={getCdnUrl(images[0], 'card')}
            alt=""
            className={imgClass}
            containerClassName="h-full w-full"
          />
        </div>
        <div className="overflow-hidden">
          <OptimizedImage
            src={getCdnUrl(images[1], 'card')}
            alt=""
            className={imgClass}
            containerClassName="h-full w-full"
          />
        </div>
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0">
        <div className="row-span-2 overflow-hidden">
          <OptimizedImage
            src={getCdnUrl(images[0], 'card')}
            alt=""
            className={imgClass}
            containerClassName="h-full w-full"
          />
        </div>
        <div className="overflow-hidden">
          <OptimizedImage
            src={getCdnUrl(images[1], 'card')}
            alt=""
            className={imgClass}
            containerClassName="h-full w-full"
          />
        </div>
        <div className="overflow-hidden">
          <OptimizedImage
            src={getCdnUrl(images[2], 'card')}
            alt=""
            className={imgClass}
            containerClassName="h-full w-full"
          />
        </div>
      </div>
    );
  }

  const display = images.slice(0, 4);
  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0">
      <div className="overflow-hidden">
        <OptimizedImage
          src={getCdnUrl(display[0], 'card')}
          alt=""
          className={imgClass}
          containerClassName="h-full w-full"
        />
      </div>
      <div className="overflow-hidden">
        <OptimizedImage
          src={getCdnUrl(display[1], 'card')}
          alt=""
          className={imgClass}
          containerClassName="h-full w-full"
        />
      </div>
      <div className="overflow-hidden">
        <OptimizedImage
          src={getCdnUrl(display[2], 'card')}
          alt=""
          className={imgClass}
          containerClassName="h-full w-full"
        />
      </div>
      <div className="overflow-hidden">
        <OptimizedImage
          src={getCdnUrl(display[3], 'card')}
          alt=""
          className={imgClass}
          containerClassName="h-full w-full"
        />
      </div>
    </div>
  );
}

export function CollectionGridCard({
  collection,
  products,
  isSelected,
  isSelectionMode,
  onToggleSelect,
  onNavigate,
  onEdit,
  onClone,
  onToggleFeatured,
  onDelete,
  updatedAgo,
  index,
}: CollectionGridCardProps) {
  const allImages = products.flatMap((p) => p.images).filter(Boolean);
  const hasImages = allImages.length > 0;
  const productCount = collection.productIds.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035, type: 'spring', stiffness: 380, damping: 28 }}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-2xl bg-card shadow-sm transition-all duration-500',
        'border-[1.5px] border-border/40 hover:border-primary/40',
        isSelected && 'border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/25',
      )}
      onClick={onNavigate}
    >
      {/* ── Top controls ── */}
      <div className="absolute left-3 right-3 top-3 z-10 flex items-start justify-between">
        <div
          className={cn(
            'transition-opacity duration-200',
            isSelected || isSelectionMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <SelectionCheckbox
            checked={isSelected}
            onChange={onToggleSelect}
            size="lg"
            animateEntry
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mais opções"
              className="h-8 w-8 rounded-xl border border-border/30 bg-background/95 shadow-sm transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
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

      {/* ── Image area ── */}
      <div className="relative aspect-[3/4] overflow-hidden bg-muted/20">
        {hasImages ? (
          <>
            <DynamicCollage images={allImages} />

            {/* Product count pill */}
            <div className="absolute right-14 top-3 z-[5] transition-all duration-200 sm:right-3 sm:group-hover:right-14">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-background/95 px-2.5 py-1 text-[11px] font-bold text-foreground shadow-sm">
                <Package className="h-3 w-3 text-primary" />
                {productCount}
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/20 bg-muted/15">
              <FolderOpen className="h-8 w-8 text-muted-foreground/25" />
            </div>
            <span className="text-xs font-medium tracking-wide text-muted-foreground/35">
              Coleção vazia
            </span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="space-y-3 border-t border-border/20 bg-card p-4">
        {/* Row 1: Icon + Title + Star */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg shadow-md"
            style={{
              backgroundColor: collection.color,
              color: '#fff',
            }}
          >
            {collection.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-display text-base font-bold leading-tight text-foreground">
              {collection.name}
            </h3>
          </div>
          {collection.isFeatured && <Star className="h-4 w-4 shrink-0 fill-primary text-primary" />}
        </div>

        {/* Row 2: Meta chips */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1 font-medium">
              <Package className="h-3 w-3 text-primary" />
              {productCount} {productCount === 1 ? 'item' : 'itens'}
            </span>
            {updatedAgo && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
                <Clock className="h-3 w-3" />
                {updatedAgo}
              </span>
            )}
          </div>

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground opacity-0 shadow-sm transition-all duration-200 group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

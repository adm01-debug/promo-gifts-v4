/**
 * CollectionListItem — Premium list view row for local collections.
 * Extracted from CollectionsPage for maintainability.
 */
import { motion } from "framer-motion";
import { MoreVertical, Pencil, Copy, Star,
  Trash2, Package, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectionCheckbox } from "@/components/common/SelectionCheckbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Collection } from "@/hooks/collections";

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
        "group flex items-center gap-4 p-3 rounded-xl bg-card border cursor-pointer transition-all duration-200",
        isSelected
          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
          : "border-border/50 hover:border-primary/40 hover:shadow-md"
      )}
      onClick={onNavigate}
    >
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <SelectionCheckbox
          checked={isSelected}
          onChange={onToggleSelect}
          size="md"
        />
      </div>
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center text-lg shrink-0 overflow-hidden"
        style={{ backgroundColor: `${collection.color}20` }}
      >
        {previewImage ? (
          <img src={previewImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <span>{collection.icon}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-semibold text-foreground truncate">{collection.name}</h3>
        {collection.description && (
          <p className="text-sm text-muted-foreground truncate">{collection.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Package className="h-3 w-3" />
          {collection.productIds.length}
        </span>
        {collection.isFeatured && <Star className="h-4 w-4 text-primary" />}
        {updatedAgo && (
          <span className="text-xs text-muted-foreground/60 hidden md:flex items-center gap-0.5">
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
              className="h-8 w-8 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-background/60 backdrop-blur-sm hover:bg-background/80"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClone(); }}>
              <Copy className="h-4 w-4 mr-2" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFeatured(); }}>
              <Star className="h-4 w-4 mr-2" />
              {collection.isFeatured ? "Remover destaque" : "Destacar"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

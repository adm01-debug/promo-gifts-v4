/**
 * Table row action buttons — extracted from ProductTableView
 */
import { Heart, GitCompare, Share2, FolderPlus, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickAddToQuote } from "../QuickAddToQuote";
import { cn } from "@/lib/utils";
import type { Product } from "@/hooks/products";
import type { VariantActionMode } from "../VariantPickerDialog";
import { showUndoToast } from "@/utils/undoToast";

interface TableRowActionsProps {
  product: Product;
  isFavorite: boolean;
  isInCompare: boolean;
  canAddToCompare: boolean;
  onToggleFavorite?: (id: string) => void;
  onToggleCompare?: (id: string) => { added: boolean; isFull: boolean };
  onOpenVariantPicker: (product: Product, mode: VariantActionMode) => void;
  onOpenQuickView: (product: Product) => void;
}

export function TableRowActions({
  product, isFavorite: fav, isInCompare: inComp, canAddToCompare,
  onToggleFavorite, onToggleCompare, onOpenVariantPicker, onOpenQuickView,
}: TableRowActionsProps) {
  return (
    <div className="flex items-center justify-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
      {/* Favoritar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost" size="icon"
            className={cn("h-7 w-7 rounded-full", fav && "text-destructive bg-destructive/10")}
            onClick={(e) => {
              e.stopPropagation();
              if (fav) {
                onToggleFavorite?.(product.id);
                showUndoToast({ title: `"${product.name}" removido dos favoritos`, onUndo: () => onToggleFavorite?.(product.id) });
              } else {
                onOpenVariantPicker(product, 'favorite');
              }
            }}
            aria-label="Favoritar"
            data-testid="product-favorite"
            aria-pressed={fav}
          >
            <Heart className={cn("h-3 w-3", fav && "fill-current")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{fav ? "Remover favorito" : "Favoritar"}</TooltipContent>
      </Tooltip>

      {/* Comparar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost" size="icon"
            className={cn("h-7 w-7 rounded-full", inComp && "text-primary bg-primary/10")}
            disabled={!inComp && !canAddToCompare}
            onClick={(e) => {
              e.stopPropagation();
              if (inComp) {
                onToggleCompare?.(product.id);
                showUndoToast({ title: `"${product.name}" removido da comparação`, onUndo: () => onToggleCompare?.(product.id) });
              } else {
                onOpenVariantPicker(product, 'compare');
              }
            }}
            aria-label="Comparar"
          >
            <GitCompare className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Comparar</TooltipContent>
      </Tooltip>

      {/* Coleção */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onOpenVariantPicker(product, 'collection'); }} aria-label="Adicionar à coleção">
            <FolderPlus className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Coleção</TooltipContent>
      </Tooltip>

      {/* Compartilhar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onOpenVariantPicker(product, 'share'); }} aria-label="Compartilhar">
            <Share2 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Compartilhar</TooltipContent>
      </Tooltip>

      {/* Orçamento */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:bg-success hover:text-success-foreground"
            onClick={(e) => { e.stopPropagation(); onOpenVariantPicker(product, 'quote'); }} aria-label="Orçamento">
            <FileText className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Orçamento</TooltipContent>
      </Tooltip>

      {/* Carrinho */}
      <QuickAddToQuote
        productId={product.id} productName={product.name} productSku={product.sku}
        productImageUrl={product.og_image_url || product.images[0]} productPrice={product.price}
        minQuantity={product.minQuantity || 1} variant="icon" className="h-7 w-7"
      />

      {/* Quick View */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onOpenQuickView(product); }} aria-label="Visualização rápida">
            <Eye className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Quick View</TooltipContent>
      </Tooltip>
    </div>
  );
}

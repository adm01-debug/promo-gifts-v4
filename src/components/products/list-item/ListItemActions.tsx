/**
 * Action buttons bar for ProductListItem — desktop & mobile
 */
import { Heart, GitCompare, Share2, FolderPlus, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { QuickAddToQuote } from "../QuickAddToQuote";
import type { Product } from "@/hooks/products";
import type { VariantActionMode } from "../VariantPickerDialog";

interface ListItemActionsProps {
  product: Product;
  isFavorited: boolean;
  isInCompare: boolean;
  canAddToCompare: boolean;
  onFavorite: (e: React.MouseEvent) => void;
  onCompare: (e: React.MouseEvent) => void;
  onVariantAction: (mode: VariantActionMode, e: React.MouseEvent) => void;
  onQuickView: (e: React.MouseEvent) => void;
}

export function ListItemActions({
  product, isFavorited, isInCompare, canAddToCompare,
  onFavorite, onCompare, onVariantAction, onQuickView,
}: ListItemActionsProps) {
  return (
    <div className={cn(
      "shrink-0 flex items-center gap-0.5",
      "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
      "transition-opacity duration-200"
    )}>
      {/* Favoritar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost" size="icon"
            className={cn("h-8 w-8 rounded-full", isFavorited ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-destructive")}
            onClick={onFavorite} aria-label="Favoritar"
            data-testid="product-favorite"
            aria-pressed={isFavorited}
          >
            <Heart className={cn("h-3.5 w-3.5", isFavorited && "fill-current")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{isFavorited ? "Remover favorito" : "Favoritar"}</TooltipContent>
      </Tooltip>

      {/* Comparar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost" size="icon"
            className={cn("h-8 w-8 rounded-full", isInCompare ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary")}
            onClick={onCompare} disabled={!isInCompare && !canAddToCompare} aria-label="Comparar"
          >
            <GitCompare className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Comparar</TooltipContent>
      </Tooltip>

      {/* Desktop-only actions */}
      <div className="hidden sm:flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={(e) => onVariantAction('share', e)} aria-label="Compartilhar">
              <Share2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Compartilhar</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={(e) => onVariantAction('collection', e)} aria-label="Adicionar à coleção">
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Coleção</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={(e) => onVariantAction('quote', e)} aria-label="Orçamento">
              <FileText className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Orçamento</TooltipContent>
        </Tooltip>
      </div>

      {/* Carrinho */}
      <QuickAddToQuote
        productId={product.id} productName={product.name} productSku={product.sku}
        productImageUrl={product.og_image_url || product.images[0]} productPrice={product.price}
        minQuantity={product.minQuantity || 1} variant="icon" className="h-8 w-8"
      />

      {/* Quick View */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hidden sm:flex"
            onClick={onQuickView} aria-label="Visualização rápida">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Quick View</TooltipContent>
      </Tooltip>
    </div>
  );
}

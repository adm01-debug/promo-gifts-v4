/**
 * ProductCardActions — FAB action buttons for ProductCard.
 * Extracted to reduce ProductCard.tsx size.
 */
import { memo } from "react";
import { Heart, Share2, Eye, GitCompare, FolderPlus, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickAddToQuote } from "./QuickAddToQuote";
import { cn } from "@/lib/utils";
import type { VariantActionMode } from "./VariantPickerDialog";

interface ProductCardActionsProps {
  productId: string;
  productName: string;
  productSku?: string | null;
  productImageUrl?: string | null;
  productPrice: number;
  productMinQuantity: number;
  isFavorited: boolean;
  isInCompare: boolean;
  canAddToCompare: boolean;
  actionsOpen: boolean;
  onToggleActions: () => void;
  onFavorite: (e: React.MouseEvent) => void;
  onCompare: (e: React.MouseEvent) => void;
  onOpenVariantPicker: (mode: VariantActionMode) => void;
  onQuickView: () => void;
  markBusy: () => void;
}

export const ProductCardActions = memo(function ProductCardActions({
  productId, productName, productSku, productImageUrl, productPrice, productMinQuantity,
  isFavorited, isInCompare, canAddToCompare,
  actionsOpen, onToggleActions, onFavorite, onCompare,
  onOpenVariantPicker, onQuickView, markBusy,
}: ProductCardActionsProps) {
  const btnClass = "h-9 w-9 md:h-11 md:w-11 rounded-full bg-card/95 backdrop-blur-md shadow-lg border border-border/50 hover:bg-card hover:scale-110 hover:shadow-xl transition-all duration-200 min-h-[36px] min-w-[36px] md:min-h-[44px] md:min-w-[44px]";

  return (
    <div
      className={cn(
        "absolute top-3 right-3 flex flex-col items-end gap-2 z-30",
        "transition-all duration-300 ease-out",
        "opacity-100 translate-x-0 md:opacity-0 md:translate-x-4",
        "md:group-hover:opacity-100 md:group-hover:translate-x-0",
      )}
    >
      {/* Main FAB */}
      <button
        type="button"
        data-testid="product-card-actions-toggle"
        data-actions-open={actionsOpen ? "true" : "false"}
        className={cn(
          "flex items-center justify-center h-9 w-9 md:h-11 md:w-11 rounded-full shadow-lg",
          "transition-all duration-300 ease-out",
          "min-h-[36px] min-w-[36px] md:min-h-[44px] md:min-w-[44px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          actionsOpen ? "bg-muted text-muted-foreground rotate-45" : "bg-orange/60 text-orange-foreground hover:bg-orange/80"
        )}
        onClick={(e) => { e.stopPropagation(); onToggleActions(); }}
        aria-label={actionsOpen ? "Fechar ações" : "Ações rápidas"}
        aria-expanded={actionsOpen}
      >
        <Plus className="h-4 w-4 md:h-5 md:w-5 transition-transform duration-200" />
      </button>

      {/* Expanded actions */}
      <div className={cn(
        "flex flex-col gap-2 transition-all duration-300 ease-out origin-top",
        actionsOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-75 -translate-y-4 pointer-events-none"
      )}>
        {/* Favorite */}
        <ActionButton icon={Heart} label={isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          testId="product-card-favorite"
          ariaPressed={isFavorited}
          className={cn(btnClass, isFavorited && "bg-destructive/10 border-destructive/30")}
          iconClassName={cn(isFavorited && "fill-destructive text-destructive scale-110 animate-heart-fill")}
          onClick={onFavorite} />

        {/* Compare */}
        <ActionButton icon={GitCompare} label={isInCompare ? "Remover da comparação" : "Adicionar à comparação"}
          className={cn(btnClass, isInCompare && "bg-primary/10 border-primary/30")}
          iconClassName={cn(isInCompare && "text-primary scale-110")}
          disabled={!isInCompare && !canAddToCompare}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onCompare(e); }} />

        {/* Collection */}
        <ActionButton icon={FolderPlus} label="Adicionar à coleção" className={btnClass}
          testId="product-card-collection"
          onClick={(e) => { e.stopPropagation(); markBusy(); onOpenVariantPicker('collection'); }} />

        {/* Share */}
        <ActionButton icon={Share2} label="Compartilhar" className={btnClass}
          testId="product-card-share"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); markBusy(); onOpenVariantPicker('share'); }} />

        {/* Quote */}
        <ActionButton icon={FileText} label="Orçamento" className={cn(btnClass, "bg-success hover:bg-success/90 text-success-foreground border-success/20 shadow-success/20 hover:scale-110 active:scale-95 disabled:opacity-50")}
          testId="product-card-quote"
          onClick={(e) => { e.stopPropagation(); markBusy(); onOpenVariantPicker('quote'); }} />

        {/* Add to Cart */}
        <QuickAddToQuote
          productId={productId} productName={productName} productSku={productSku}
          productImageUrl={productImageUrl} productPrice={productPrice}
          minQuantity={productMinQuantity} variant="icon"
          className="h-9 w-9 md:h-11 md:w-11 min-h-[36px] min-w-[36px] md:min-h-[44px] md:min-w-[44px] bg-primary hover:bg-primary/90 text-primary-foreground border-primary/20 shadow-primary/20 hover:scale-110 active:scale-95 disabled:opacity-50"
        />

        {/* Quick View */}
        <ActionButton icon={Eye} label="Visualização Rápida" shortcut="Q" className={btnClass}
          testId="product-card-quickview"
          onClick={(e) => { e.stopPropagation(); markBusy(); onQuickView(); }} />
      </div>
    </div>
  );
});

// Tiny helper to reduce repetition
function ActionButton({
  icon: Icon, label, shortcut, className, iconClassName, disabled, onClick, testId, ariaPressed,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; shortcut?: string; className?: string; iconClassName?: string;
  disabled?: boolean; onClick: (e: React.MouseEvent) => void;
  testId?: string;
  ariaPressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="secondary" size="icon" className={className} disabled={disabled}
          onClick={onClick} aria-label={label}
          data-testid={testId}
          aria-pressed={ariaPressed}>
          <Icon className={cn("h-4 w-4 md:h-5 md:w-5 transition-all duration-300", iconClassName)} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="flex items-center gap-2">
        {label}
        {shortcut && <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

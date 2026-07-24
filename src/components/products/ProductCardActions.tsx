/**
 * ProductCardActions — FAB action buttons for ProductCard.
 * Extracted to reduce ProductCard.tsx size.
 *
 * Order standardized (left-to-right/top-to-bottom):
 * 1 - Carrinho
 * 2 - Orçamento
 * 3 - Coleção
 * 4 - Favoritar
 * 5 - Comparar
 * 6 - Quick View
 * 7 - Compartilhar
 *
 * FIX 2026-06-15: Removido disabled={isOutOfStock} de ambos os botões.
 * Em brindes corporativos, orçamentos e pré-pedidos para produtos sem
 * estoque são práticas normais — itens são produzidos/importados sob
 * demanda. O badge 'ESTOQUE ZERADO' já comunica a situação visualmente.
 * disabled em <button> bloqueia TODOS os eventos de clique silenciosamente
 * (comportamento nativo HTML), causando a percepção de "nada acontece".
 */
import { memo } from 'react';
import { Heart, Share2, Eye, GitCompare, FolderPlus, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { QuickAddToQuote } from './QuickAddToQuote';
import { cn } from '@/lib/utils';
import { feedback } from '@/lib/feedback';
import type { VariantActionMode } from './VariantPickerDialog';

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
  isOutOfStock?: boolean;
  onFavorite: (e: React.MouseEvent) => void;
  onCompare: (e: React.MouseEvent) => void;
  onOpenVariantPicker: (mode: VariantActionMode) => void;
  onQuickView: () => void;
  markBusy: () => void;
}

export const ProductCardActions = memo(
  ({
    productId,
    productName,
    productSku,
    productImageUrl,
    productPrice,
    productMinQuantity,
    isFavorited,
    isInCompare,
    canAddToCompare,
    actionsOpen,
    onToggleActions,
    isOutOfStock: _isOutOfStock = false,
    onFavorite,
    onCompare,
    onOpenVariantPicker,
    onQuickView,
    markBusy,
  }: ProductCardActionsProps) => {
    const btnClass =
      'h-9 w-9 md:h-11 md:w-11 rounded-full bg-card/95 backdrop-blur-md shadow-lg border border-border/50 hover:bg-card hover:scale-110 hover:shadow-xl transition-all duration-200 min-h-[36px] min-w-[36px] md:min-h-[44px] md:min-w-[44px]';

    return (
      <div
        className={cn(
          'absolute right-3 top-3 z-30 flex flex-col items-end gap-2',
          'transition-all duration-300 ease-out',
          'translate-x-0 opacity-100 md:translate-x-4 md:opacity-0',
          'md:group-hover:translate-x-0 md:group-hover:opacity-100',
        )}
      >
        {/* Main FAB */}
        <button
          type="button"
          data-testid="product-card-actions-toggle"
          data-actions-open={actionsOpen ? 'true' : 'false'}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full shadow-lg md:h-11 md:w-11',
            'transition-all duration-300 ease-out',
            'min-h-[36px] min-w-[36px] md:min-h-[44px] md:min-w-[44px]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            actionsOpen
              ? 'rotate-45 bg-muted text-muted-foreground'
              : 'bg-brand-primary/60 text-brand-primary-foreground hover:bg-brand-primary/80',
          )}
          onClick={(e) => {
            e.stopPropagation();
            feedback.light();
            onToggleActions();
          }}
          aria-label={actionsOpen ? 'Fechar ações' : 'Ações rápidas'}
          aria-expanded={actionsOpen}
        >
          <Plus className="h-4 w-4 transition-transform duration-200 md:h-5 md:w-5" />
        </button>

        {/* Expanded actions (Top to Bottom mapping to Left to Right order) */}
        <div
          className={cn(
            'flex origin-top flex-col gap-2 transition-all duration-300 ease-out',
            actionsOpen
              ? 'translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-4 scale-75 opacity-0',
          )}
        >
          {/* 1 - Carrinho
            FIX 2026-06-15: disabled removido — pré-pedidos/orçamentos para
            produtos sem estoque são válidos em brindes corporativos. */}
          <QuickAddToQuote
            productId={productId}
            productName={productName}
            productSku={productSku ?? undefined}
            productImageUrl={productImageUrl ?? undefined}
            productPrice={productPrice}
            minQuantity={productMinQuantity}
            variant="icon"
            disabled={false}
            className="h-9 min-h-[36px] w-9 min-w-[36px] border-primary/20 bg-primary text-primary-foreground shadow-primary/20 hover:scale-110 hover:bg-primary/90 md:h-11 md:min-h-[44px] md:w-11 md:min-w-[44px]"
          />

          {/* 2 - Orçamento
            FIX 2026-06-15: disabled removido — orçamentos para produtos sem
            estoque são padrão em brindes (produção/importação sob demanda).
            O badge 'ESTOQUE ZERADO' já comunica a situação ao usuário. */}
          <ActionButton
            icon={FileText}
            label="Orçamento"
            className={cn(
              btnClass,
              'border-success/20 bg-success text-success-foreground shadow-success/20 hover:scale-110 hover:bg-success/90',
            )}
            testId="product-card-quote"
            onClick={(e) => {
              e.stopPropagation();
              markBusy();
              onOpenVariantPicker('quote');
            }}
          />

          {/* 3 - Coleção */}
          <ActionButton
            icon={FolderPlus}
            label="Coleção"
            className={btnClass}
            testId="product-card-collection"
            onClick={(e) => {
              e.stopPropagation();
              markBusy();
              onOpenVariantPicker('collection');
            }}
          />

          {/* 4 - Favoritar */}
          <ActionButton
            icon={Heart}
            label={isFavorited ? 'Remover favorito' : 'Favoritar'}
            testId="product-card-favorite"
            ariaPressed={isFavorited}
            className={cn(btnClass, isFavorited && 'border-destructive/30 bg-destructive/10')}
            iconClassName={cn(
              isFavorited && 'fill-destructive text-destructive scale-110 animate-heart-fill',
            )}
            onClick={onFavorite}
          />

          {/* 5 - Comparar */}
          <ActionButton
            icon={GitCompare}
            label="Comparar"
            className={cn(btnClass, isInCompare && 'border-primary/30 bg-primary/10')}
            iconClassName={cn(isInCompare && 'text-primary scale-110')}
            disabled={!isInCompare && !canAddToCompare}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onCompare(e);
            }}
          />

          {/* 6 - Quick View */}
          <ActionButton
            icon={Eye}
            label="Quick View"
            shortcut="Q"
            className={btnClass}
            testId="product-card-quickview"
            onClick={(e) => {
              e.stopPropagation();
              feedback.light();
              markBusy();
              onQuickView();
            }}
          />

          {/* 7 - Compartilhar */}
          <ActionButton
            icon={Share2}
            label="Compartilhar"
            className={btnClass}
            testId="product-card-share"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              markBusy();
              onOpenVariantPicker('share');
            }}
          />
        </div>
      </div>
    );
  },
);

// Tiny helper to reduce repetition
function ActionButton({
  icon: Icon,
  label,
  shortcut,
  className,
  iconClassName,
  disabled,
  onClick,
  testId,
  ariaPressed,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  className?: string;
  iconClassName?: string;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
  testId?: string;
  ariaPressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className={className}
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          data-testid={testId}
          aria-pressed={ariaPressed}
        >
          <Icon
            className={cn('h-4 w-4 transition-all duration-300 md:h-5 md:w-5', iconClassName)}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="flex items-center gap-2">
        {label}
        {shortcut && (
          <kbd className="text-tooltip pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono font-medium opacity-100 sm:flex">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * BulkActionBar — Barra flutuante premium para ações em lote no catálogo.
 * Aparece quando 1+ produtos estão selecionados em qualquer visualização.
 *
 * 🎨 DESIGN 10/10:
 * - Glass morphism com blur intenso
 * - Spring animations com stagger nos botões
 * - Ícones semânticos para cada ação
 * - Separadores visuais entre grupos de ação
 * - Responsivo: labels escondidos em mobile, apenas ícones
 */
import { memo } from 'react';
import {
  Heart,
  GitCompare,
  FolderPlus,
  X,
  CheckSquare,
  ShoppingBag,
  FileText,
  FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { m as motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkFavorite: () => void;
  onBulkCompare: () => void;
  onBulkCollection: () => void;
  onBulkCart?: () => void;
  onBulkQuote?: () => void;
  onBulkPDF?: () => void;
  selectedTotalValue?: number;
}

const actionVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.04, type: 'spring', stiffness: 500, damping: 30 },
  }),
};

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
  index,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  index: number;
}) {
  return (
    <motion.div custom={index} variants={actionVariants} initial="hidden" animate="visible">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-xs font-medium transition-all hover:scale-105 active:scale-95',
              className,
            )}
            onClick={onClick}
            disabled={disabled}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="sm:hidden">
          {label}
        </TooltipContent>
      </Tooltip>
    </motion.div>
  );
}

export const BulkActionBar = memo(
  ({
    selectedCount,
    totalCount,
    onSelectAll,
    onClearSelection,
    onBulkFavorite,
    onBulkCompare,
    onBulkCollection,
    onBulkCart,
    onBulkQuote,
    onBulkPDF,
    selectedTotalValue = 0,
  }: BulkActionBarProps) => {
    return (
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
              'flex items-center gap-1.5 rounded-2xl px-3 py-2.5 sm:gap-3 sm:px-5',
              'border border-primary/20 bg-card/95 backdrop-blur-xl',
              'shadow-[0_8px_40px_-8px_hsl(var(--primary)/0.25),0_2px_12px_-2px_rgba(0,0,0,0.4)]',
            )}
          >
            {/* Selection counter */}
            <motion.div
              className="flex items-center gap-2 border-r border-border/50 pr-2.5 sm:pr-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Badge
                variant="default"
                className="min-w-[1.75rem] justify-center bg-primary px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary-foreground"
              >
                {selectedCount}
              </Badge>
              <div className="flex flex-col">
                <span className="hidden whitespace-nowrap text-sm text-muted-foreground sm:inline">
                  selecionado{selectedCount > 1 ? 's' : ''}
                </span>
                {selectedTotalValue > 0 && (
                  <span className="text-[10px] font-bold leading-tight text-primary">
                    {formatCurrency(selectedTotalValue)}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Primary actions — Cart & Quote */}
            {(onBulkCart || onBulkQuote) && (
              <div className="flex items-center gap-0.5 border-r border-border/50 pr-2 sm:pr-2.5">
                {onBulkCart && (
                  <ActionButton
                    icon={ShoppingBag}
                    label="Carrinho"
                    onClick={onBulkCart}
                    index={0}
                    className="text-cart hover:bg-cart/10 hover:text-cart"
                  />
                )}
                {onBulkQuote && (
                  <ActionButton
                    icon={FileText}
                    label="Orçamento"
                    onClick={onBulkQuote}
                    index={1}
                    className="text-primary hover:bg-primary/10 hover:text-primary"
                  />
                )}
                {onBulkPDF && (
                  <ActionButton
                    icon={FileDown}
                    label="Catálogo"
                    onClick={onBulkPDF}
                    index={2}
                    className="text-brand-primary-500 hover:text-brand-primary-500 hover:bg-brand-primary-500/10"
                  />
                )}
              </div>
            )}

            {/* Secondary actions */}
            <div className="flex items-center gap-0.5">
              <ActionButton icon={Heart} label="Favoritar" onClick={onBulkFavorite} index={3} />
              <ActionButton
                icon={GitCompare}
                label="Comparar"
                onClick={onBulkCompare}
                disabled={selectedCount > 4}
                index={4}
              />
              <ActionButton
                icon={FolderPlus}
                label="Coleção"
                onClick={onBulkCollection}
                index={5}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-0.5 border-l border-border/50 pl-2 sm:pl-2.5">
              {selectedCount < totalCount && (
                <motion.div custom={5} variants={actionVariants} initial="hidden" animate="visible">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={onSelectAll}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Todos</span>
                  </Button>
                </motion.div>
              )}
              <motion.div custom={6} variants={actionVariants} initial="hidden" animate="visible">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={onClearSelection}
                  aria-label="Limpar seleção"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

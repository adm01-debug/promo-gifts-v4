/**
 * StockBulkActionBar — Barra fixa inferior com ações em lote para o estoque
 * (paridade com o catálogo, em escala variation-aware).
 */
import { Heart, GitCompare, FileText, X, CheckSquare, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StockBulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onBulkFavorite: () => void;
  onBulkCompare: () => void;
  onBulkQuote: () => void;
  onBulkCollection: () => void;
}

export function StockBulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  onBulkFavorite,
  onBulkCompare,
  onBulkQuote,
}: StockBulkActionBarProps) {
  const disabled = selectedCount === 0;

  return (
    <div
      data-testid="stock-bulk-action-bar"
      className={cn(
        'pointer-events-auto fixed inset-x-0 bottom-3 z-40 mx-auto w-[min(98vw,960px)]',
        'rounded-2xl border border-border/60 bg-card/95 px-3 py-2 shadow-2xl backdrop-blur',
        'flex flex-wrap items-center gap-2',
      )}
      role="region"
      aria-label="Barra de ações em lote do estoque"
    >
      <div className="flex items-center gap-2 pr-2">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {selectedCount}/{totalCount}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {selectedCount === 0
            ? 'Selecione variações para agir em lote'
            : selectedCount === 1
              ? 'item selecionado'
              : 'itens selecionados'}
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onSelectAll}
          data-testid="stock-bulk-select-all"
          className="h-8 gap-1"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Selecionar visíveis
        </Button>

        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={onBulkFavorite}
          data-testid="stock-bulk-favorite"
          className="h-8 gap-1"
        >
          <Heart className="h-3.5 w-3.5" />
          Favoritar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={onBulkCompare}
          data-testid="stock-bulk-compare"
          className="h-8 gap-1"
        >
          <GitCompare className="h-3.5 w-3.5" />
          Comparar
        </Button>
        <Button
          size="sm"
          variant="default"
          disabled={disabled}
          onClick={onBulkQuote}
          data-testid="stock-bulk-quote"
          className="h-8 gap-1"
        >
          <FileText className="h-3.5 w-3.5" />
          Orçamento
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          data-testid="stock-bulk-clear"
          aria-label="Sair do modo seleção"
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

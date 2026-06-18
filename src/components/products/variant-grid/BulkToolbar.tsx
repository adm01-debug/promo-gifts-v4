/**
 * BulkToolbar — Toolbar de ações em lote para VariantGridMatrix
 */
import { useState } from 'react';
import { CheckSquare, Minus, ToggleLeft, ToggleRight, Boxes } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface BulkToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleActive: (active: boolean) => void;
  onUpdateStock: (stock: number) => void;
  isLoading: boolean;
}

export function BulkToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onToggleActive,
  onUpdateStock,
  isLoading,
}: BulkToolbarProps) {
  const [stockValue, setStockValue] = useState('');
  const [stockPopoverOpen, setStockPopoverOpen] = useState(false);

  const handleStockSubmit = () => {
    const num = parseInt(stockValue, 10);
    if (Number.isNaN(num) || num < 0) return;
    onUpdateStock(num);
    setStockValue('');
    setStockPopoverOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 duration-200 animate-in slide-in-from-top-2">
      <div className="mr-2 flex items-center gap-2">
        <Badge variant="secondary" className="text-xs font-semibold">
          {selectedCount}/{totalCount} selecionados
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
        >
          {selectedCount === totalCount ? (
            <>
              <Minus className="mr-1 h-3 w-3" />
              Limpar
            </>
          ) : (
            <>
              <CheckSquare className="mr-1 h-3 w-3" />
              Selecionar tudo
            </>
          )}
        </Button>
      </div>
      <div className="h-5 w-px bg-border" />
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => onToggleActive(true)}
        disabled={isLoading}
      >
        <ToggleRight className="h-3.5 w-3.5 text-success" />
        Ativar
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => onToggleActive(false)}
        disabled={isLoading}
      >
        <ToggleLeft className="h-3.5 w-3.5 text-destructive" />
        Desativar
      </Button>
      <div className="h-5 w-px bg-border" />
      <Popover open={stockPopoverOpen} onOpenChange={setStockPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={isLoading}>
            <Boxes className="h-3.5 w-3.5 text-primary" />
            Estoque em lote
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Definir estoque para {selectedCount} variações
            </p>
            <Input
              type="number"
              min={0}
              placeholder="Quantidade"
              value={stockValue}
              onChange={(e) => setStockValue(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleStockSubmit()}
              autoFocus
            />
            <Button
              size="sm"
              className="h-7 w-full text-xs"
              onClick={handleStockSubmit}
              disabled={
                !stockValue ||
                Number.isNaN(parseInt(stockValue, 10)) ||
                parseInt(stockValue, 10) < 0
              }
            >
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto h-7 text-xs text-muted-foreground"
        onClick={onDeselectAll}
      >
        Cancelar
      </Button>
    </div>
  );
}

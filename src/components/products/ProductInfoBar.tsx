import { useNavigate } from 'react-router-dom';
import { Building2, CalendarClock, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getSupplierColors } from '@/lib/supplier-colors';

interface ProductInfoBarProps {
  sku: string;
  supplierName?: string;
  supplierId?: string;
  onOpenFutureStock: () => void;
  onOpenSupplierComparison: () => void;
  hasFutureStock?: boolean;
}

export function ProductInfoBar({
  sku,
  supplierName = '',
  supplierId,
  onOpenFutureStock,
  onOpenSupplierComparison,
  hasFutureStock: _hasFutureStock = true,
}: ProductInfoBarProps) {
  const navigate = useNavigate();

  const handleSupplierClick = () => {
    if (supplierId) {
      navigate(`/filtros?supplier=${supplierId}`);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* SKU */}
      <Badge
        variant="secondary"
        data-testid="product-sku"
        className="rounded-full bg-muted px-3 py-1.5 font-mono text-xs"
      >
        SKU: {sku}
      </Badge>

      {/* Fornecedor - Clicável, abre Super Filtro com esse fornecedor */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'group/supplier rounded-full border-border bg-card px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-[1.02]',
              supplierId && 'cursor-pointer',
            )}
            style={{
              ['--supplier-color' as string]: getSupplierColors(supplierName).hex,
            }}
            onClick={handleSupplierClick}
          >
            <Building2
              className={cn(
                'mr-1.5 h-3.5 w-3.5 transition-colors',
                getSupplierColors(supplierName).text,
              )}
            />
            <span className="transition-colors group-hover/supplier:text-[var(--supplier-color)]">
              {supplierName}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Ver todos os produtos de {supplierName}</TooltipContent>
      </Tooltip>

      {/* Estoque Futuro */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFutureStock}
            className="h-8 gap-1.5 rounded-full px-3 text-xs hover:border-brand-primary/50 hover:bg-brand-primary/5"
          >
            <CalendarClock className="h-3.5 w-3.5 text-brand-primary" />
            Estoque Futuro
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver previsão de reposição de estoque</TooltipContent>
      </Tooltip>

      {/* Comparar Fornecedores */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSupplierComparison}
            className="h-8 gap-1.5 rounded-full px-3 text-xs"
          >
            <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
            Comparar Fornecedores
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver mesmo produto em outros fornecedores</TooltipContent>
      </Tooltip>
    </div>
  );
}

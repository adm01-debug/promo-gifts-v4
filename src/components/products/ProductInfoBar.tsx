import { useNavigate } from "react-router-dom";
import { Building2, CalendarClock, GitCompare, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getSupplierColors } from "@/lib/supplier-colors";

interface ProductInfoBarProps {
  sku: string;
  supplierName: string;
  supplierId?: string;
  onOpenFutureStock: () => void;
  onOpenSupplierComparison: () => void;
  hasFutureStock?: boolean;
}

export function ProductInfoBar({
  sku,
  supplierName,
  supplierId,
  onOpenFutureStock,
  onOpenSupplierComparison,
  hasFutureStock = true,
}: ProductInfoBarProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast(); // Need to import this or just use navigator

  const handleCopySKU = async () => {
    try {
      await navigator.clipboard.writeText(sku);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent fail
    }
  };

  const handleSupplierClick = () => {
    if (supplierId) {
      navigate(`/filtros?supplier=${supplierId}`);
    }
  };
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* SKU */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className="font-mono text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 cursor-pointer transition-colors group/sku"
            onClick={handleCopySKU}
          >
            SKU: {sku}
            <div className="ml-2 inline-flex items-center">
              {copied ? (
                <Check className="h-3 w-3 text-success animate-in zoom-in duration-300" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/sku:opacity-100 transition-opacity" />
              )}
            </div>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {copied ? 'Copiado!' : 'Clique para copiar o SKU'}
        </TooltipContent>
      </Tooltip>

      {/* Fornecedor - Clicável, abre Super Filtro com esse fornecedor */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs px-3 py-1.5 rounded-full font-medium border-border bg-card transition-all duration-200 hover:scale-[1.02] group/supplier",
              supplierId && "cursor-pointer"
            )}
            style={{
              ['--supplier-color' as string]: getSupplierColors(supplierName).hex,
            }}
            onClick={handleSupplierClick}
          >
            <Building2 
              className={cn("h-3.5 w-3.5 mr-1.5 transition-colors", getSupplierColors(supplierName).text)} 
            />
            <span className="group-hover/supplier:text-[var(--supplier-color)] transition-colors">
              {supplierName}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Ver todos os produtos de {supplierName}
        </TooltipContent>
      </Tooltip>

      {/* Estoque Futuro */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFutureStock}
            className="rounded-full h-8 px-3 text-xs gap-1.5 hover:border-orange/50 hover:bg-orange/5"
          >
            <CalendarClock className="h-3.5 w-3.5 text-orange" />
            Estoque Futuro
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Ver previsão de reposição de estoque
        </TooltipContent>
      </Tooltip>

      {/* Comparar Fornecedores */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSupplierComparison}
            className="rounded-full h-8 px-3 text-xs gap-1.5"
          >
            <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
            Comparar Fornecedores
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Ver mesmo produto em outros fornecedores
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

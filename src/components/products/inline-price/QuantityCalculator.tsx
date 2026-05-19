import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowRight, Info, Calculator, Loader2 } from "lucide-react";
import React from "react";

interface QuantityCalculatorProps {
  customQuantity: number;
  onQuantityChange: (qty: number) => void;
  minQuantity: number;
  unitPrice: number;
  total: number;
  discount: number;
  formatPrice: (price: number) => string;
  compact?: boolean;
  isLoading?: boolean;
}

export function QuantityCalculator({
  customQuantity, onQuantityChange, minQuantity, unitPrice, total, discount, formatPrice, compact = false, isLoading = false,
}: QuantityCalculatorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onQuantityChange(Math.max(minQuantity, parseInt(e.target.value) || minQuantity));

  if (compact) {
    return (
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-sm text-foreground">Calcule seu pedido</h4>
          <Tooltip><TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground/50" /></TooltipTrigger><TooltipContent>Digite a quantidade desejada para ver o preço aplicado</TooltipContent></Tooltip>
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-1 flex-1">
            <Label htmlFor="custom-qty" className="text-[10px] text-muted-foreground uppercase tracking-wider">Quantidade</Label>
            <Input id="custom-qty" type="number" min={minQuantity} value={customQuantity} onChange={handleChange} className="h-11 font-bold text-base" />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 mt-5 shrink-0" />
          <div className="space-y-1 flex-[1.5]">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Resultado</Label>
            <div className="h-11 px-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-2 relative">
              {isLoading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg z-10"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>}
              <span className="font-bold text-base text-success whitespace-nowrap">{formatPrice(total)}</span>
              <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap">({formatPrice(unitPrice)}/un)</span>
            </div>
          </div>
        </div>
        <Button className="w-full gap-2 h-11 font-bold" size="lg">
          <Calculator className="h-4 w-4" />
          Adicionar {Math.round(customQuantity + Number.EPSILON).toLocaleString('pt-BR')} un ao Orçamento
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h4 className="font-semibold text-sm">Calcule seu pedido</h4>
        <Tooltip><TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent>Digite a quantidade desejada para ver o preço aplicado</TooltipContent></Tooltip>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-2">
          <Label htmlFor="custom-qty-col" className="text-sm">Quantidade</Label>
          <Input id="custom-qty-col" type="number" min={minQuantity} value={customQuantity} onChange={handleChange} className="h-12" />
        </div>
        <div className="flex items-end"><ArrowRight className="h-5 w-5 text-muted-foreground mb-4 hidden sm:block" /></div>
        <div className="flex-1 space-y-2">
          <Label className="text-sm">Resultado</Label>
          <div className="h-12 px-4 rounded-lg bg-success/10 border border-success/20 flex items-center justify-between relative">
            {isLoading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg z-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
            <div>
              <span className="font-bold text-lg text-success">{formatPrice(total)}</span>
              {discount > 0 && <Badge variant="secondary" className="ml-2 bg-success/20 text-success text-xs">-{discount}%</Badge>}
            </div>
            <span className="text-sm text-muted-foreground">({formatPrice(unitPrice)}/un)</span>
          </div>
        </div>
      </div>
      <Button className="w-full gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] font-bold" size="lg">
        <Calculator className="h-4 w-4" />
        Adicionar {Math.round(customQuantity + Number.EPSILON).toLocaleString('pt-BR')} un ao Orçamento
      </Button>
    </div>
  );
}

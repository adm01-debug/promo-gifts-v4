/**
 * PriceResultV51 - Exibe resultado de cálculo de preço v5.1
 * 
 * LÓGICA v5.1:
 * - Setup = PISO MÍNIMO (não é somado!)
 * - Se subtotal < faturamento_minimo → Total = faturamento_minimo
 * - Se subtotal >= faturamento_minimo → Total = subtotal
 * - Código de orçamento: {TECNICA_CURTO}01-{FAIXA}-{AREA}-{CORES}
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calculator,
  Clock,
  TrendingDown, Package,
  Paintbrush,
  Copy,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from './utils';
import type { CustomizationPriceV2 } from '@/hooks/simulation';
import { toast } from 'sonner';

interface PriceResultV51Props {
  productName: string;
  productPrice: number;
  quantity: number;
  priceData: CustomizationPriceV2;
  showDetails?: boolean;
}

export function PriceResultV51({
  productName,
  productPrice,
  quantity,
  priceData,
  showDetails = true,
}: PriceResultV51Props) {
  const [copied, setCopied] = useState(false);

  // Cálculos derivados
  const productTotal = productPrice * quantity;
  const grandTotal = productTotal + priceData.total_price;
  const unitTotal = grandTotal / quantity;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(priceData.codigo_orcamento);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Resumo do Orçamento
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCopyCode}
                  className="font-mono gap-2"
                >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-primary dark:text-primary" />
            ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {priceData.codigo_orcamento}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Código de orçamento - clique para copiar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Produto */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Package className="w-4 h-4 text-muted-foreground" />
            Produto
          </div>
          <div className="flex justify-between text-sm pl-6">
            <span className="text-muted-foreground truncate max-w-[200px]">
              {productName}
            </span>
          </div>
          <div className="flex justify-between text-sm pl-6">
            <span className="text-muted-foreground">
              {formatNumber(quantity)} × {formatCurrency(productPrice)}
            </span>
            <span>{formatCurrency(productTotal)}</span>
          </div>
        </div>

        <Separator />

        {/* Personalização */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Paintbrush className="w-4 h-4 text-muted-foreground" />
            Personalização
            <Badge variant="secondary" className="ml-auto font-mono text-xs">
              {priceData.tabela_codigo_curto}
            </Badge>
          </div>
          
          <div className="pl-6 space-y-2">
            {/* Técnica e área */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{priceData.technique}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Área: {priceData.area_name} ({priceData.area_code})
              </span>
            </div>
            
            {priceData.num_cores > 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cores: {priceData.num_cores}</span>
              </div>
            )}

            {showDetails && (
              <>
                {/* Faixa de quantidade */}
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>
                    Faixa {priceData.tier_used}: {formatNumber(priceData.tier_min_qty)} - {formatNumber(priceData.tier_max_qty)} un
                  </span>
                </div>

                {/* Preço unitário */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Preço unitário
                  </span>
                  <span>{formatCurrency(priceData.unit_price)}</span>
                </div>
              </>
            )}

            {/* Subtotal peças */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Subtotal ({formatNumber(quantity)} × {formatCurrency(priceData.unit_price)})
              </span>
              <span>{formatCurrency(priceData.subtotal_pecas)}</span>
            </div>

            {/* Faturamento mínimo (se aplicado) */}
            {priceData.minimum_applied && (
              <div className="flex items-center justify-between text-sm p-2 rounded bg-warning/10 dark:bg-warning/10 text-warning dark:text-warning">
                <div className="flex items-center gap-1">
            <Info className="w-4 h-4" />
                  <span>Faturamento mínimo aplicado</span>
                </div>
                <span className="font-semibold">{formatCurrency(priceData.faturamento_minimo_gravacao)}</span>
              </div>
            )}
          </div>

          {/* Total gravação */}
          <div className="flex justify-between text-sm pt-2 pl-6 border-t border-dashed font-medium">
            <span>Total gravação</span>
            <span className={cn(
              priceData.minimum_applied && "text-warning dark:text-warning"
            )}>
              {formatCurrency(priceData.total_price)}
            </span>
          </div>
        </div>

        <Separator />

        {/* Total geral */}
        <div className="pt-2 flex justify-between font-bold text-lg">
          <span>Total Geral</span>
          <span className="text-primary">{formatCurrency(grandTotal)}</span>
        </div>

        <div className="text-sm text-center text-muted-foreground">
          = {formatCurrency(unitTotal)} por unidade completa
        </div>

        {/* Margem (se disponível) */}
        {showDetails && priceData.margin_percent > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-primary dark:text-primary">
            <TrendingDown className="w-4 h-4" />
            <span>Margem: {priceData.margin_percent.toFixed(1)}%</span>
          </div>
        )}

        {/* Prazo */}
        {priceData.production_days && priceData.production_days > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
            <Clock className="w-4 h-4" />
            <span>Prazo estimado: {priceData.production_days} dias úteis</span>
          </div>
        )}

        {/* Markup info (apenas em modo detalhes) */}
        {showDetails && (
          <div className="text-xs text-center text-muted-foreground mt-2">
            <span>Markup: {priceData.markup_percent}% | </span>
            <span>Preço mínimo unitário: {formatCurrency(priceData.preco_minimo_unitario)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Componente para exibir código de orçamento inline
 */
export function QuoteCodeBadge({ 
  code, 
  variant = 'default' 
}: { 
  code: string; 
  variant?: 'default' | 'secondary' | 'outline';
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={variant} 
            className="font-mono cursor-pointer gap-1 hover:opacity-80 transition-opacity"
            onClick={handleCopy}
          >
            {copied ? (
              <CheckCircle2 className="w-3 h-3 text-primary dark:text-primary" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {code}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Clique para copiar</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

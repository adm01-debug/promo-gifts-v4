/**
 * QuantityAndResult - Seletor de quantidade e resultado v5.1
 *
 * Usa a RPC fn_get_customization_price para cálculos com:
 * - Markup (115%)
 * - Faturamento mínimo (setup como piso, não soma!)
 * - Código de orçamento automático
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calculator,
  Clock,
  TrendingDown,
  AlertCircle,
  Copy,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
<<<<<<< HEAD
import { useCustomizationPriceLegacy, type CustomizationPriceV2 } from '@/hooks/simulation';
import { formatCurrency, formatNumber } from './utils';
import type { Product, ProductTechnique } from './types';
=======
import {
  useCustomizationPriceLegacy, type CustomizationPriceV2
} from '@/hooks/simulation';
import { formatCurrency, formatNumber } from './utils';
import type { Product, ProductTechnique } from "./types";
>>>>>>> origin/main
import { toast } from 'sonner';

interface QuantityAndResultProps {
  product: Product;
  technique: ProductTechnique;
  colors: number;
  sizeModifier: number;
  quantity: number;
  onQuantityChange: (qty: number) => void;
}

export function QuantityAndResult({
  product,
  technique,
  colors,
  quantity,
  onQuantityChange,
}: QuantityAndResultProps) {
  const { calculatePrice } = useCustomizationPriceLegacy();
  const [priceData, setPriceData] = useState<CustomizationPriceV2 | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Calcular preço quando quantidade ou parâmetros mudam
  useEffect(() => {
    const calculate = async () => {
      setIsCalculating(true);
      setError(null);

      try {
        // Usar o ID da técnica como ID da área
        const result = await calculatePrice(technique.id, quantity, colors);

        if (result?.success) {
          setPriceData(result);
        } else {
          setError('Erro ao calcular preço');
          setPriceData(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        setPriceData(null);
      } finally {
        setIsCalculating(false);
      }
    };

    const debounce = setTimeout(calculate, 300);
    return () => clearTimeout(debounce);
  }, [technique.id, quantity, colors, calculatePrice]);

  // Cálculos derivados
  const productTotal = product.price * quantity;
  const customizationTotal = priceData?.total_price || 0;
  const grandTotal = productTotal + customizationTotal;
  const unitTotal = quantity > 0 ? grandTotal / quantity : 0;

  const handleCopyCode = () => {
    if (!priceData?.codigo_orcamento) return;
    navigator.clipboard.writeText(priceData.codigo_orcamento);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const quickQuantities = [50, 100, 250, 500, 1000, 2500, 5000];

  return (
    <div className="space-y-6">
      {/* Quantity selector */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Quantidade</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={50000}
              value={quantity}
              onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-28 text-right"
            />
            <span className="text-sm text-muted-foreground">unidades</span>
          </div>
        </div>

        <Slider
          value={[quantity]}
          onValueChange={([val]) => onQuantityChange(val)}
          min={1}
          max={10000}
          step={1}
        />

        <div className="flex flex-wrap gap-2">
          {quickQuantities.map((qty) => (
            <Button
              key={qty}
              variant={quantity === qty ? 'default' : 'outline'}
              size="sm"
              onClick={() => onQuantityChange(qty)}
            >
              {formatNumber(qty)}
            </Button>
          ))}
        </div>
      </div>

      {/* Result */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              Resumo do Orçamento
              {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>

            {priceData?.codigo_orcamento && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyCode}
                      className="gap-2 font-mono"
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-primary dark:text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {priceData.codigo_orcamento}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Código de orçamento - clique para copiar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
              <AlertCircle className="mb-2 h-5 w-5" />
              <p className="font-medium">Erro ao calcular preço</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {/* Produto */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Produtos ({formatNumber(quantity)} × {formatCurrency(product.price)})
                  </span>
                  <span>{formatCurrency(productTotal)}</span>
                </div>

                {priceData && (
                  <>
                    {/* Gravação */}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {priceData.technique}
                        {priceData.num_cores > 1 && ` (${priceData.num_cores}c)`}
                      </span>
                    </div>

                    <div className="flex justify-between pl-4 text-sm">
                      <span className="text-muted-foreground">
                        {formatNumber(quantity)} × {formatCurrency(priceData.unit_price)}
                        <span className="ml-1 text-xs">(Faixa {priceData.tier_used})</span>
                      </span>
                      <span>{formatCurrency(priceData.subtotal_pecas)}</span>
                    </div>

                    {/* Faturamento mínimo aplicado */}
                    {priceData.minimum_applied && (
                      <div className="flex items-center justify-between rounded bg-warning/10 p-2 text-sm text-warning dark:bg-warning/10 dark:text-warning">
                        <div className="flex items-center gap-1">
                          <Info className="h-4 w-4" />
                          <span>Faturamento mínimo aplicado</span>
                        </div>
                        <span className="font-semibold">
                          {formatCurrency(priceData.faturamento_minimo_gravacao)}
                        </span>
                      </div>
                    )}

                    {/* Subtotal gravação */}
                    <div className="flex justify-between border-t border-dashed pt-1 text-sm">
                      <span className="text-muted-foreground">Subtotal gravação</span>
                      <span
                        className={cn(
                          'font-medium',
                          priceData.minimum_applied && 'text-warning dark:text-warning',
                        )}
                      >
                        {formatCurrency(priceData.total_price)}
                      </span>
                    </div>
                  </>
                )}

                {/* Total */}
                <div className="flex justify-between border-t pt-2 text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(grandTotal)}</span>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  = {formatCurrency(unitTotal)} por unidade
                </div>
              </div>

              {/* Margem */}
              {priceData && priceData.margin_percent > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 p-3">
                  <TrendingDown className="h-5 w-5 text-primary dark:text-primary" />
                  <span className="text-sm font-medium text-primary dark:text-primary">
                    Margem: {priceData.margin_percent.toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Prazo */}
              {priceData?.production_days && priceData.production_days > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Prazo estimado: {priceData.production_days} dias úteis</span>
                </div>
              )}

              {/* Info sobre markup */}
              {priceData && (
                <div className="mt-2 text-center text-xs text-muted-foreground">
                  <span>Markup: {priceData.markup_percent}% | </span>
                  <span>
                    Preço mín. unitário: {formatCurrency(priceData.preco_minimo_unitario)}
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Info box sobre a lógica v5.1 */}
      {priceData && (
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium">📊 Sistema de Preços v5.1</p>
          <p>
            O setup é aplicado como <strong>faturamento mínimo</strong>, não é somado ao total. Se o
            subtotal das peças for menor que o mínimo, o total será igual ao faturamento mínimo.
          </p>
        </div>
      )}
    </div>
  );
}

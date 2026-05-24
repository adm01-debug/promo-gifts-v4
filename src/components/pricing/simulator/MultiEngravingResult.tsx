/**
 * MultiEngravingResult - Resultado de mÃºltiplas gravaÃ§Ãµes v5.1
 *
 * Usa a RPC fn_get_customization_price para cÃ¡lculos com:
 * - Markup (115%)
 * - Faturamento mÃ­nimo (setup como piso)
 * - CÃ³digo de orÃ§amento automÃ¡tico
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calculator,
  Clock,
  AlertCircle,
  Package,
  Paintbrush,
  Copy,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCustomizationPriceLegacy, type CustomizationPriceV2 } from '@/hooks/simulation';
import { formatCurrency, formatNumber } from './utils';
import type { Product, ConfiguredEngraving } from './types';
import { toast } from 'sonner';

interface MultiEngravingResultProps {
  product: Product;
  engravings: ConfiguredEngraving[];
  quantity: number;
  onQuantityChange: (qty: number) => void;
}

interface EngravingCalculationV51 {
  engraving: ConfiguredEngraving;
  priceData: CustomizationPriceV2 | null;
  loading: boolean;
  error: string | null;
}

export function MultiEngravingResult({
  product,
  engravings,
  quantity,
  onQuantityChange,
}: MultiEngravingResultProps) {
  const { calculatePrice } = useCustomizationPriceLegacy();
  const [calculations, setCalculations] = useState<EngravingCalculationV51[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Recalcular quando quantidade ou gravaÃ§Ãµes mudam
  useEffect(() => {
    const calculateAll = async () => {
      if (engravings.length === 0) {
        setCalculations([]);
        return;
      }

      setIsCalculating(true);

      const results = await Promise.all(
        engravings.map(async (engraving) => {
          try {
            // Usar ID da Ã¡rea da tÃ©cnica selecionada
            // Assumindo que technique.id Ã© o ID da Ã¡rea de impressÃ£o
            const areaId = engraving.technique.id;

            const priceData = await calculatePrice(areaId, quantity, engraving.colors || 1);

            return {
              engraving,
              priceData,
              loading: false,
              error: priceData?.success === false ? 'Erro no cÃ¡lculo' : null,
            };
          } catch (err) {
            return {
              engraving,
              priceData: null,
              loading: false,
              error: err instanceof Error ? err.message : 'Erro desconhecido',
            };
          }
        }),
      );

      setCalculations(results);
      setIsCalculating(false);
    };

    const debounce = setTimeout(calculateAll, 300);
    return () => clearTimeout(debounce);
  }, [engravings, quantity, calculatePrice]);

  // Totais
  const productTotal = product.price * quantity;
  const customizationTotal = calculations.reduce(
    (sum, calc) => sum + (calc.priceData?.total_price || 0),
    0,
  );
  const grandTotal = productTotal + customizationTotal;
  const unitTotal = quantity > 0 ? grandTotal / quantity : 0;

  // Prazo mÃ¡ximo
  const maxSlaDays = Math.max(
    ...calculations.map((c) => c.priceData?.production_days || 0).filter(Boolean),
    0,
  );

  // Verificar se hÃ¡ erros
  const hasErrors = calculations.some((c) => c.error || !c.priceData?.success);

  // Verificar se algum aplicou faturamento mÃ­nimo
  const hasMinimumApplied = calculations.some((c) => c.priceData?.minimum_applied);

  // Coletar todos os cÃ³digos de orÃ§amento
  const allCodes = calculations
    .map((c) => c.priceData?.codigo_orcamento)
    .filter((code): code is string => !!code);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    toast.success('CÃ³digo copiado!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyAllCodes = () => {
    navigator.clipboard.writeText(allCodes.join(' | '));
    toast.success('Todos os cÃ³digos copiados!');
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

      {/* Warning if errors */}
      {hasErrors && !isCalculating && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="mb-2 h-5 w-5" />
          <p className="font-medium">Algumas tÃ©cnicas nÃ£o puderam ser calculadas</p>
          <p className="mt-1 text-sm">
            Verifique se as Ã¡reas estÃ£o corretamente configuradas no banco de dados.
          </p>
        </div>
      )}

      {/* Result */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              Resumo do OrÃ§amento
              {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>

            {allCodes.length > 1 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleCopyAllCodes}>
                      <Copy className="mr-1 h-4 w-4" />
                      Copiar CÃ³digos
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copiar todos os cÃ³digos de orÃ§amento</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Produto */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4 text-muted-foreground" />
              Produto
            </div>
            <div className="flex justify-between pl-6 text-sm">
              <span className="max-w-[200px] truncate text-muted-foreground">{product.name}</span>
            </div>
            <div className="flex justify-between pl-6 text-sm">
              <span className="text-muted-foreground">
                {formatNumber(quantity)} Ã— {formatCurrency(product.price)}
              </span>
              <span>{formatCurrency(productTotal)}</span>
            </div>
          </div>

          <Separator />

          {/* GravaÃ§Ãµes */}
          {engravings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Paintbrush className="h-4 w-4 text-muted-foreground" />
                PersonalizaÃ§Ãµes ({engravings.length})
              </div>

              {calculations.map((calc, idx) => (
                <div
                  key={calc.engraving.id}
                  className="space-y-1 border-b border-dashed py-2 pl-6 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-muted-foreground">
                      {idx + 1}. {calc.engraving.technique.techniqueName}
                      {calc.engraving.colors > 1 && ` (${calc.engraving.colors}c)`}
                    </span>

                    {calc.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : calc.error || !calc.priceData?.success ? (
                      <span className="text-sm text-destructive">N/D</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="cursor-pointer font-mono text-xs transition-colors hover:bg-muted"
                          onClick={() => handleCopyCode(calc.priceData?.codigo_orcamento ?? '')}
                        >
                          {copied === calc.priceData.codigo_orcamento ? (
                            <CheckCircle2 className="mr-1 h-3 w-3 text-primary dark:text-primary" />
                          ) : (
                            <Copy className="mr-1 h-3 w-3" />
                          )}
                          {calc.priceData.codigo_orcamento}
                        </Badge>
                        <span
                          className={cn(
                            'text-sm font-medium',
                            calc.priceData.minimum_applied && 'text-warning dark:text-warning',
                          )}
                        >
                          {formatCurrency(calc.priceData.total_price)}
                        </span>
                      </div>
                    )}
                  </div>

                  {calc.priceData?.success && (
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>
                          {formatNumber(quantity)} Ã— {formatCurrency(calc.priceData.unit_price)}{' '}
                          (Faixa {calc.priceData.tier_used})
                        </span>
                        <span>{formatCurrency(calc.priceData.subtotal_pecas)}</span>
                      </div>

                      {calc.priceData.minimum_applied && (
                        <div className="flex items-center gap-1 text-warning dark:text-warning">
                          <Info className="h-3 w-3" />
                          <span>
                            Fat. mÃ­nimo aplicado:{' '}
                            {formatCurrency(calc.priceData.faturamento_minimo_gravacao)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Subtotal personalizaÃ§Ã£o */}
              <div className="flex justify-between pl-6 pt-2 text-sm font-medium">
                <span>Subtotal gravaÃ§Ãµes</span>
                <span>{formatCurrency(customizationTotal)}</span>
              </div>
            </div>
          )}

          <Separator />

          {/* Total */}
          <div className="flex justify-between pt-2 text-lg font-bold">
            <span>Total Geral</span>
            <span className="text-primary">{formatCurrency(grandTotal)}</span>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            = {formatCurrency(unitTotal)} por unidade completa
          </div>

          {/* Info sobre faturamento mÃ­nimo */}
          {hasMinimumApplied && (
            <div className="rounded-lg bg-warning/10 p-3 text-sm text-warning dark:bg-warning/10 dark:text-warning">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                <span className="font-medium">Faturamento mÃ­nimo aplicado</span>
              </div>
              <p className="mt-1 text-xs">
                O valor do setup foi aplicado como piso mÃ­nimo em uma ou mais tÃ©cnicas. Aumente a
                quantidade para diluir o custo.
              </p>
            </div>
          )}

          {/* Prazo */}
          {maxSlaDays > 0 && (
            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Prazo estimado: {maxSlaDays} dias Ãºteis</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

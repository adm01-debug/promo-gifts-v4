/**
 * QuantityComparisonTable — Compare prices across quantities and techniques.
 */
import { useMemo, useCallback } from 'react';
import { useCustomizationPricing } from '@/hooks/simulation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calculator, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type CalcProduct,
  type SelectedTechniqueConfig,
  availableSizes,
  formatCurrency,
  formatNumber,
} from './types';

interface Props {
  product: CalcProduct;
  selectedConfigs: SelectedTechniqueConfig[];
  quantities: number[];
}

export function QuantityComparisonTable({ product, selectedConfigs, quantities }: Props) {
  const { priceTables, calculatePrice } = useCustomizationPricing();

  const calculateForConfig = useCallback(
    (config: SelectedTechniqueConfig, quantity: number) => {
      const { technique, colors, sizeModifier } = config;
      const matchingTable = priceTables.find(
        (t) =>
          t.table_code.toLowerCase().includes(technique.techniqueCode.toLowerCase()) ||
          technique.techniqueCode.toLowerCase().includes(t.table_code.toLowerCase()) ||
          t.customization_type_name.toLowerCase().includes(technique.techniqueName.toLowerCase()) ||
          technique.techniqueName.toLowerCase().includes(t.customization_type_name.toLowerCase()),
      );
      if (!matchingTable) return null;
      const calc = calculatePrice(matchingTable.table_code, quantity);
      if (!calc) return null;

      let modifiedUnitPrice = calc.unitPrice;
      if (colors > 1 && matchingTable.price_by_color) modifiedUnitPrice *= 1 + (colors - 1) * 0.1;
      modifiedUnitPrice *= sizeModifier;

      const customizationTotal = modifiedUnitPrice * quantity + calc.setupPrice;
      const productTotal = product.price * quantity;
      const grandTotal = productTotal + customizationTotal;
      return {
        unitPrice: modifiedUnitPrice,
        customizationTotal,
        productTotal,
        grandTotal,
        unitTotal: grandTotal / quantity,
        slaDays: calc.slaDays,
      };
    },
    [priceTables, calculatePrice, product.price],
  );

  const bestPricePerConfig = useMemo(() => {
    const map = new Map<string, number>();
    selectedConfigs.forEach((config) => {
      let bestQty = -1,
        bestUnit = Infinity;
      quantities.forEach((qty) => {
        const result = calculateForConfig(config, qty);
        if (result?.unitTotal !== undefined && result.unitTotal < bestUnit) {
          bestUnit = result.unitTotal;
          bestQty = qty;
        }
      });
      if (bestQty > 0) map.set(config.technique.id, bestQty);
    });
    return map;
  }, [selectedConfigs, quantities, calculateForConfig]);

  if (selectedConfigs.length === 0)
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Calculator className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>Selecione técnicas para ver a comparação de preços</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">Técnica</TableHead>
              {quantities.map((qty) => (
                <TableHead key={qty} className="min-w-[100px] text-center">
                  {formatNumber(qty)} un
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedConfigs.map((config) => (
              <TableRow key={config.technique.id}>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{config.technique.techniqueName}</p>
                    <p className="text-xs text-muted-foreground">
                      {config.colors} cor{config.colors > 1 ? 'es' : ''} •{' '}
                      {
                        availableSizes
                          .find((s) => s.value === config.sizeOption)
                          ?.label.split(' ')[0]
                      }
                    </p>
                  </div>
                </TableCell>
                {quantities.map((qty) => {
                  const result = calculateForConfig(config, qty);
                  const isBest = bestPricePerConfig.get(config.technique.id) === qty;
                  if (!result)
                    return (
                      <TableCell key={qty} className="text-center text-xs text-muted-foreground">
                        N/D
                      </TableCell>
                    );
                  return (
                    <TableCell
                      key={qty}
                      className={cn(
                        'relative text-center',
                        isBest && 'rounded-lg border border-success/30 bg-success/10',
                      )}
                    >
                      {isBest && <Trophy className="absolute right-1 top-1 h-3 w-3 text-success" />}
                      <div className="space-y-1">
                        <p
                          className={cn(
                            'text-sm font-bold',
                            isBest ? 'text-success' : 'text-primary',
                          )}
                        >
                          {formatCurrency(result.unitTotal)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total: {formatCurrency(result.grandTotal)}
                        </p>
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            <TableRow className="bg-muted/30">
              <TableCell>
                <div>
                  <p className="text-sm font-medium">Apenas Produto</p>
                  <p className="text-xs text-muted-foreground">Sem gravação</p>
                </div>
              </TableCell>
              {quantities.map((qty) => (
                <TableCell key={qty} className="text-center">
                  <div className="space-y-1">
                    <p className="text-sm font-bold">{formatCurrency(product.price)}</p>
                    <p className="text-xs text-muted-foreground">
                      Total: {formatCurrency(product.price * qty)}
                    </p>
                  </div>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <p className="mb-1 font-medium">Valores incluem:</p>
        <ul className="list-inside list-disc space-y-0.5">
          <li>Preço do produto ({formatCurrency(product.price)}/un)</li>
          <li>Custo de gravação por unidade</li>
          <li>Custo de setup (quando aplicável)</li>
        </ul>
      </div>
    </div>
  );
}

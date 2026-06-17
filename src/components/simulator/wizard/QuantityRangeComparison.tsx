/**
 * QuantityRangeComparison - Compare pricing across multiple quantities
 *
 * Shows a side-by-side table of how pricing changes at different quantity tiers.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, Plus, X, TrendingDown } from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { invokeExternalRpc } from '@/lib/external-rpc';
import { formatCurrency } from '@/lib/format';
import type { CustomizationPriceResponse } from '@/hooks/simulation';
import { adaptPriceResponse } from '@/lib/personalization/adapters';
import type { Personalization } from '@/types/domain/simulator-wizard';

interface QuantityRangeComparisonProps {
  personalizations: Personalization[];
  currentQuantity: number;
  productPrice: number;
}

interface QuantityResult {
  quantity: number;
  persPrices: { persId: string; unitPrice: number; totalPrice: number }[];
  grandTotal: number;
  grandPerUnit: number;
  isLoading: boolean;
}

const DEFAULT_QUANTITIES = [50, 100, 250, 500, 1000];

// formatCurrency imported from @/lib/format

export function QuantityRangeComparison({
  personalizations,
  currentQuantity,
  productPrice,
}: QuantityRangeComparisonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [quantities, setQuantities] = useState<number[]>(() => {
    const defaults = DEFAULT_QUANTITIES.filter((q) => q !== currentQuantity);
    const selected = [currentQuantity, ...defaults.slice(0, 3)].sort((a, b) => a - b);
    return selected;
  });
  const [results, setResults] = useState<QuantityResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [customQty, setCustomQty] = useState('');

  const addQuantity = () => {
    const qty = parseInt(customQty, 10);
    if (!qty || qty <= 0 || quantities.includes(qty)) return;
    if (quantities.length >= 6) {
      toast.warning('Máximo 6 quantidades');
      return;
    }
    setQuantities((prev) => [...prev, qty].sort((a, b) => a - b));
    setCustomQty('');
    setResults([]); // Reset results
  };

  const removeQuantity = (qty: number) => {
    if (quantities.length <= 2) return;
    setQuantities((prev) => prev.filter((q) => q !== qty));
    setResults([]);
  };

  const calculateAll = useCallback(async () => {
    if (personalizations.length === 0) return;
    setIsCalculating(true);

    try {
      const allResults: QuantityResult[] = [];

      for (const qty of quantities) {
        const persPrices: QuantityResult['persPrices'] = [];

        for (const pers of personalizations) {
          try {
            const rpcParams: Record<string, unknown> = {
              p_area_id: pers.technique.id,
              p_quantidade: qty,
              p_num_cores: pers.specs.colors,
            };
            if (pers.specs.width > 0 && pers.specs.height > 0) {
              rpcParams.p_largura_cm = pers.specs.width;
              rpcParams.p_altura_cm = pers.specs.height;
            }

            const result = await invokeExternalRpc<CustomizationPriceResponse>(
              'fn_get_customization_price',
              rpcParams,
            );

            if (result?.success) {
              const flat = adaptPriceResponse(result);
              persPrices.push({
                persId: pers.id,
                unitPrice: flat.unit_price,
                totalPrice: flat.total_price,
              });
            } else {
              persPrices.push({ persId: pers.id, unitPrice: 0, totalPrice: 0 });
            }
          } catch {
            persPrices.push({ persId: pers.id, unitPrice: 0, totalPrice: 0 });
          }
        }

        const customTotal = persPrices.reduce((s, p) => s + p.totalPrice, 0);
        const productTotal = productPrice * qty;
        const grandTotal = productTotal + customTotal;

        allResults.push({
          quantity: qty,
          persPrices,
          grandTotal,
          grandPerUnit: qty > 0 ? grandTotal / qty : 0,
          isLoading: false,
        });
      }

      setResults(allResults);
    } catch {
      toast.error('Erro ao calcular faixas de quantidade');
    } finally {
      setIsCalculating(false);
    }
  }, [quantities, personalizations, productPrice]);

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="lg"
        className="h-14 gap-2 rounded-xl px-6"
        onClick={() => setIsOpen(true)}
      >
        <BarChart3 className="h-5 w-5" />
        Comparar Quantidades
      </Button>
    );
  }

  const lowestPerUnit = results.length > 0 ? Math.min(...results.map((r) => r.grandPerUnit)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-5 rounded-2xl border bg-card p-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-bold">Comparativo por Quantidade</h4>
            <p className="text-xs text-muted-foreground">
              Veja como o preço muda em diferentes tiragens
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quantity pills */}
      <div className="flex flex-wrap items-center gap-2">
        {quantities.map((qty) => (
          <Badge
            key={qty}
            variant={qty === currentQuantity ? 'default' : 'secondary'}
            className="cursor-default gap-1.5 px-3 py-1.5 text-sm"
          >
            {qty}un
            {quantities.length > 2 && qty !== currentQuantity && (
              <button
                type="button"
                onClick={() => removeQuantity(qty)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder="Qtd"
            value={customQty}
            onChange={(e) => setCustomQty(e.target.value)}
            className="h-8 w-20 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && addQuantity()}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={addQuantity}
            aria-label="Adicionar"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calculate */}
      <Button
        onClick={calculateAll}
        disabled={isCalculating || quantities.length < 2}
        className="w-full gap-2"
      >
        {isCalculating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculando {quantities.length} faixas...
          </>
        ) : (
          <>
            <BarChart3 className="h-4 w-4" />
            Calcular {quantities.length} Faixas
          </>
        )}
      </Button>

      {/* Results Table */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Quantidade
                  </th>
                  {personalizations.map((p, idx) => (
                    <th
                      key={p.id}
                      className="px-3 py-2 text-right font-medium text-muted-foreground"
                    >
                      Grav. {idx + 1}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-right font-semibold">Por Unid.</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const isCurrent = r.quantity === currentQuantity;
                  const isBest = r.grandPerUnit === lowestPerUnit;
                  return (
                    <tr
                      key={r.quantity}
                      className={isCurrent ? 'bg-primary/5 font-semibold' : 'hover:bg-muted/30'}
                    >
                      <td className="flex items-center gap-2 px-3 py-2.5">
                        {r.quantity}un
                        {isCurrent && (
                          <Badge variant="outline" className="py-0 text-[10px]">
                            atual
                          </Badge>
                        )}
                      </td>
                      {r.persPrices.map((pp) => (
                        <td key={pp.persId} className="px-3 py-2.5 text-right">
                          {formatCurrency(pp.totalPrice)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right font-bold">
                        {formatCurrency(r.grandTotal)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="flex items-center justify-end gap-1">
                          {isBest && <TrendingDown className="h-3.5 w-3.5 text-success" />}
                          <span
                            className={isBest ? 'font-bold text-success dark:text-success' : ''}
                          >
                            {formatCurrency(r.grandPerUnit)}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

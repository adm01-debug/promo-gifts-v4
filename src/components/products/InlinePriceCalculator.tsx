/**
 * InlinePriceCalculator — Refactored orchestrator
 * Table + Calculator extracted to sub-components.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { PriceTiersTable } from './inline-price/PriceTiersTable';
import { QuantityCalculator } from './inline-price/QuantityCalculator';

import { logger } from '@/lib/logger';
interface PriceTableRow {
  quantity: number;
  unitPrice: number;
  total: number;
  discount?: number;
}

interface SupplierSourcePricing {
  id: string;
  cost_price?: number | null;
  cost_price_1?: number | null;
  cost_price_2?: number | null;
  cost_price_3?: number | null;
  cost_price_4?: number | null;
  cost_price_5?: number | null;
  min_qty_1?: number | null;
  min_qty_2?: number | null;
  min_qty_3?: number | null;
  min_qty_4?: number | null;
  min_qty_5?: number | null;
}

interface InlinePriceCalculatorProps {
  productId?: string;
  variantId?: string;
  basePrice: number;
  minQuantity?: number;
  productName: string;
  className?: string;
  defaultOpen?: boolean;
}

const extractPriceTiersFromSource = (
  source: SupplierSourcePricing,
  basePrice: number,
): PriceTableRow[] => {
  const tiers: PriceTableRow[] = [];
  const baseCost = source.cost_price_1 ?? source.cost_price ?? null;
  const markupRatio = baseCost && baseCost > 0 ? basePrice / baseCost : 1;

  for (let i = 1; i <= 5; i++) {
    const costPrice = source[`cost_price_${i}` as keyof SupplierSourcePricing] as number | null;
    const qty = source[`min_qty_${i}` as keyof SupplierSourcePricing] as number | null;
    if (costPrice !== null && costPrice > 0) {
      const quantity = qty !== null && qty > 0 ? qty : i === 1 ? 1 : i * 50;
      const salePrice = costPrice * markupRatio;
      tiers.push({
        quantity,
        unitPrice: Number(salePrice.toFixed(2)),
        total: Number((salePrice * quantity).toFixed(2)),
        discount: 0,
      });
    }
  }
  tiers.sort((a, b) => a.quantity - b.quantity);
  const refPrice = tiers.length > 0 ? tiers[0].unitPrice : basePrice;
  tiers.forEach((tier, idx) => {
    tier.discount =
      idx === 0
        ? 0
        : refPrice > 0
          ? Math.max(0, Math.round((1 - tier.unitPrice / refPrice) * 100))
          : 0;
  });
  return tiers;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

export function InlinePriceCalculator({
  productId,
  variantId,
  basePrice,
  minQuantity = 1,
  productName: _productName,
  className,
  defaultOpen = false,
}: InlinePriceCalculatorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [customQuantity, setCustomQuantity] = useState<number>(minQuantity);
  const [priceTiers, setPriceTiers] = useState<PriceTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchPriceTiers() {
      if (!productId) {
        setPriceTiers([]);
        return;
      }
      setIsLoading(true);
      try {
        const variantFilters: Record<string, unknown> = { product_id: productId, is_active: true };
        if (variantId) variantFilters.id = variantId;
        const variantResponse = await dbInvoke<{ id: string }>({
          table: 'product_variants',
          operation: 'select',
          select: 'id',
          filters: variantFilters,
        });
        const variants = variantResponse?.records ?? [];
        if (variants.length === 0) {
          setPriceTiers([]);
          setIsLoading(false);
          return;
        }
        const targetVariantId = variants[0].id;
        const sourceResponse = await dbInvoke({
          table: 'variant_supplier_sources',
          operation: 'select',
          select:
            'id,cost_price,cost_price_1,cost_price_2,cost_price_3,cost_price_4,cost_price_5,min_qty_1,min_qty_2,min_qty_3,min_qty_4,min_qty_5',
          filters: { variant_id: targetVariantId, is_active: true, is_preferred: true },
        });
        const sources = sourceResponse?.records ?? [];
        if (sources.length > 0) {
          setPriceTiers(
            extractPriceTiersFromSource(sources[0] as SupplierSourcePricing, basePrice),
          );
        } else {
          setPriceTiers([]);
        }
      } catch (error) {
        logger.error('Error fetching price tiers:', error);
        setPriceTiers([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPriceTiers();
  }, [productId, variantId, basePrice, minQuantity]);

  const getCustomPrice = (qty: number) => {
    if (priceTiers.length === 0) return { unitPrice: basePrice, discount: 0 };
    const tier = [...priceTiers].reverse().find((t) => qty >= t.quantity);
    return tier
      ? { unitPrice: tier.unitPrice, discount: tier.discount || 0 }
      : { unitPrice: priceTiers[0]?.unitPrice || basePrice, discount: 0 };
  };

  const customPriceInfo = getCustomPrice(customQuantity);
  const customTotal = customPriceInfo.unitPrice * customQuantity + Number.EPSILON;

  if (defaultOpen) {
    return (
      <div className={cn('space-y-5', className)}>
        <div className="overflow-hidden rounded-xl border border-border/40">
          <PriceTiersTable
            tiers={priceTiers}
            isLoading={isLoading}
            compact
            formatPrice={formatPrice}
          />
        </div>
        <QuantityCalculator
          compact
          customQuantity={customQuantity}
          onQuantityChange={setCustomQuantity}
          minQuantity={minQuantity}
          unitPrice={customPriceInfo.unitPrice}
          total={customTotal}
          discount={customPriceInfo.discount}
          formatPrice={formatPrice}
          isLoading={isLoading}
        />
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-4 transition-colors hover:bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Tabela de Preços</CardTitle>
                  <p className="text-sm text-muted-foreground">Veja os descontos por quantidade</p>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            <div className="overflow-hidden rounded-lg border border-border">
              <PriceTiersTable tiers={priceTiers} isLoading={isLoading} formatPrice={formatPrice} />
            </div>
            <Separator />
            <QuantityCalculator
              customQuantity={customQuantity}
              onQuantityChange={setCustomQuantity}
              minQuantity={minQuantity}
              unitPrice={customPriceInfo.unitPrice}
              total={customTotal}
              discount={customPriceInfo.discount}
              formatPrice={formatPrice}
              isLoading={isLoading}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

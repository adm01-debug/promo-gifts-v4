import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  generatePriceBreakdown,
  calculateTotalKitPrice,
  type KitState,
} from '@/lib/kit-builder';

interface KitPricingCardProps {
  kitState: KitState;
  kitQuantity: number;
  onKitQuantityChange: (quantity: number) => void;
}

export function KitPricingCard({
  kitState,
  kitQuantity,
  onKitQuantityChange,
}: KitPricingCardProps) {
  const { box, items, personalization } = kitState;
  const pricing = calculateTotalKitPrice(box, items, personalization, kitQuantity);
  const breakdown = generatePriceBreakdown(box, items, personalization, kitQuantity);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Detalhamento de Preços</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {breakdown.map((item, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-between py-2',
                  item.isPersonalization && 'pl-4 text-primary',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(item.isPersonalization && 'text-sm')}>{item.label}</span>
                  {item.quantity && item.quantity > 1 && (
                    <span className="text-xs text-muted-foreground">
                      ({item.quantity}x {formatCurrency(item.unitPrice)})
                    </span>
                  )}
                </div>
                <span className={cn('font-medium', item.isPersonalization && 'text-sm')}>
                  {formatCurrency(item.totalPrice)}
                </span>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                Produtos ({kitQuantity} {kitQuantity === 1 ? 'kit' : 'kits'})
              </span>
              <span>{formatCurrency(pricing.subtotal)}</span>
            </div>
            {pricing.personalizationPrice > 0 && (
              <div className="flex justify-between text-sm text-primary">
                <span>Personalização</span>
                <span>{formatCurrency(pricing.personalizationPrice)}</span>
              </div>
            )}
          </div>
          <Separator className="my-4" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold">Total</p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(pricing.unitPrice)}/kit
              </p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatCurrency(pricing.total)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Preço por Quantidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[50, 100, 200, 500, 1000].map((qty) => {
              const qtyPricing = calculateTotalKitPrice(box, items, personalization, qty);
              const isCurrentQty = qty === kitQuantity;
              return (
                <button
                  key={qty}
                  onClick={() => onKitQuantityChange(qty)}
                  className={cn(
                    'cursor-pointer rounded-lg border p-2.5 transition-all',
                    isCurrentQty
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border/50 bg-secondary/30 hover:border-primary/30',
                  )}
                >
                  <p className="text-[11px] text-muted-foreground">{qty} kits</p>
                  <p className={cn('text-sm font-bold', isCurrentQty && 'text-primary')}>
                    {formatCurrency(qtyPricing.unitPrice)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">/kit</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

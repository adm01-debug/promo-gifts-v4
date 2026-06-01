/**
 * Margin simulator card — extracted from KitSummary
 */
import { useState } from 'react';
import { TrendingUp, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/kit-builder';

interface KitMarginSimulatorProps {
  unitPrice: number;
  totalPrice: number;
  kitQuantity: number;
}

export function KitMarginSimulator({
  unitPrice,
  totalPrice,
  kitQuantity,
}: KitMarginSimulatorProps) {
  const [markupPercent, setMarkupPercent] = useState<number>(30);

  const costPerKit = unitPrice;
  const sellPerKit = costPerKit * (1 + markupPercent / 100);
  const sellTotal = sellPerKit * kitQuantity;
  const profitPerKit = sellPerKit - costPerKit;
  const profitTotal = sellTotal - totalPrice;
  const marginPercent = sellPerKit > 0 ? (profitPerKit / sellPerKit) * 100 : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Simulação de Margem
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-[180px] space-y-1">
            <Label htmlFor="markup" className="text-sm">
              Markup (%)
            </Label>
            <div className="relative">
              <Input
                id="markup"
                type="number"
                min={0}
                max={500}
                step={5}
                value={markupPercent}
                onChange={(e) => setMarkupPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                className="pr-8"
              />
              <Percent className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="flex gap-1.5 pt-5">
            {[20, 30, 50, 80, 100].map((v) => (
              <Button
                key={v}
                variant={markupPercent === v ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => setMarkupPercent(v)}
              >
                {v}%
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <p className="mb-1 text-[11px] text-muted-foreground">Venda/Kit</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(sellPerKit)}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <p className="mb-1 text-[11px] text-muted-foreground">Venda Total ({kitQuantity}x)</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(sellTotal)}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-center">
            <p className="mb-1 text-[11px] text-muted-foreground">Lucro/Kit</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(profitPerKit)}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-center">
            <p className="mb-1 text-[11px] text-muted-foreground">Lucro Total</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(profitTotal)}</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
          <span className="text-muted-foreground">Margem Líquida</span>
          <span
            className={cn(
              'text-lg font-bold',
              marginPercent >= 20 ? 'text-primary' : 'text-destructive',
            )}
          >
            {marginPercent.toFixed(1)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

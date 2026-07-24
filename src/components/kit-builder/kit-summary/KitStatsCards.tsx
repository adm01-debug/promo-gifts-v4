import { Card, CardContent } from '@/components/ui/card';
import { Package, Gift, Palette, Scale } from 'lucide-react';
import type { KitState } from '@/lib/kit-builder';

interface KitStatsCardsProps {
  kitState: KitState;
  totalItems: number;
  itemsCount: number;
  personalizedCount: number;
}

export function KitStatsCards({
  kitState,
  totalItems,
  itemsCount,
  personalizedCount,
}: KitStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="pt-6 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="text-2xl font-bold">1</p>
          <p className="text-sm text-muted-foreground">Embalagem</p>
          {kitState.box && (
            <p className="mt-1 truncate px-2 text-xs text-muted-foreground">{kitState.box.name}</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <Gift className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="text-2xl font-bold">{totalItems}</p>
          <p className="text-sm text-muted-foreground">
            {itemsCount} {itemsCount === 1 ? 'item' : 'itens diferentes'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <Palette className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="text-2xl font-bold">{personalizedCount}</p>
          <p className="text-sm text-muted-foreground">
            {personalizedCount === 1 ? 'Personalização' : 'Personalizações'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <Scale className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="text-2xl font-bold">
            {kitState.totalWeight >= 1000
              ? `${(kitState.totalWeight / 1000).toFixed(1)}kg`
              : `${kitState.totalWeight}g`}
          </p>
          <p className="text-sm text-muted-foreground">Peso estimado</p>
        </CardContent>
      </Card>
    </div>
  );
}

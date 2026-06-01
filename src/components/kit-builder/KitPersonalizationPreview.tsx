/**
 * KitPersonalizationPreview — Card que exibe um toggle "com/sem personalização"
 * e mostra um sumário visual de quais itens/caixa terão gravação aplicada,
 * com badges semânticos. Reaproveitável junto ao preview isométrico.
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KitState } from '@/lib/kit-builder/types';
import { formatCurrency } from '@/lib/kit-builder';

interface KitPersonalizationPreviewProps {
  kitState: KitState;
  className?: string;
}

export function KitPersonalizationPreview({ kitState, className }: KitPersonalizationPreviewProps) {
  const [showPersonalization, setShowPersonalization] = useState(true);

  const boxPers = kitState.personalization.box;
  const itemPersEntries = Object.entries(kitState.personalization.items).filter(
    ([, p]) => p?.enabled,
  );

  const hasAnyPersonalization = boxPers?.enabled || itemPersEntries.length > 0;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Personalização ao vivo
          </h3>
          <div className="flex items-center gap-2">
            <Label htmlFor="pers-toggle" className="cursor-pointer text-xs text-muted-foreground">
              {showPersonalization ? 'Com logo' : 'Sem logo'}
            </Label>
            <Switch
              id="pers-toggle"
              checked={showPersonalization}
              onCheckedChange={setShowPersonalization}
              disabled={!hasAnyPersonalization}
            />
          </div>
        </div>

        {!hasAnyPersonalization && (
          <p className="text-xs text-muted-foreground">
            Configure gravação na etapa de personalização para ver o preview aqui.
          </p>
        )}

        {hasAnyPersonalization && (
          <div className="space-y-2">
            {boxPers?.enabled && (
              <div
                className={cn(
                  'flex items-center justify-between rounded-md border p-2 transition-opacity',
                  !showPersonalization && 'opacity-30',
                )}
              >
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Caixa</span>
                  {boxPers.techniqueName && (
                    <Badge variant="outline" className="text-[10px]">
                      {boxPers.techniqueName}
                    </Badge>
                  )}
                </div>
                {boxPers.estimatedPrice ? (
                  <span className="text-xs font-medium text-primary">
                    +{formatCurrency(boxPers.estimatedPrice)}
                  </span>
                ) : null}
              </div>
            )}

            {itemPersEntries.map(([itemId, p]) => {
              const item = kitState.items.find((i) => i.id === itemId);
              if (!item) return null;
              return (
                <div
                  key={itemId}
                  className={cn(
                    'flex items-center justify-between rounded-md border p-2 transition-opacity',
                    !showPersonalization && 'opacity-30',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="truncate font-medium">{item.name}</span>
                    {p?.techniqueName && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {p.techniqueName}
                      </Badge>
                    )}
                  </div>
                  {p?.estimatedPrice ? (
                    <span className="shrink-0 text-xs font-medium text-primary">
                      +{formatCurrency(p.estimatedPrice)}
                    </span>
                  ) : null}
                </div>
              );
            })}

            <div className="flex items-center justify-between border-t pt-2 text-xs">
              <span className="text-muted-foreground">Acréscimo total/kit</span>
              <span className="font-semibold text-primary">
                {formatCurrency(kitState.personalizationPrice)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

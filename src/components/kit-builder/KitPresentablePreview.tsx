/**
 * Kit Presentable Preview — client-facing proposal view
 * Renders the kit as a visual presentation card with narrative, items grid,
 * and pricing summary.
 */
import { useMemo } from 'react';
import { Sparkles, Calendar, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, type KitState } from '@/lib/kit-builder';

interface KitPresentablePreviewProps {
  kitState: KitState;
  kitQuantity: number;
  kitName: string;
  currentKitId?: string;
}

function buildNarrative(kitState: KitState, kitName: string): string {
  const itemCount = kitState.items.length;
  const totalUnits = kitState.items.reduce((s, i) => s + i.quantity, 0);
  const personalized =
    Object.values(kitState.personalization.items).filter((p) => p.enabled).length +
    (kitState.personalization.box.enabled ? 1 : 0);
  const label = kitName?.trim() || 'Este kit';
  const personalizationLine =
    personalized > 0
      ? ` Conta com ${personalized} ponto(s) de personalização para reforçar a identidade da sua marca.`
      : '';
  const boxLine = kitState.box ? ` Apresentado em ${kitState.box.name.toLowerCase()},` : '';
  return `${label} foi pensado para gerar conexão e gratidão.${boxLine} reúne ${itemCount} produto(s) selecionado(s) (${totalUnits} unidade(s) no total) que combinam utilidade, design e qualidade.${personalizationLine}`;
}

export function KitPresentablePreview({
  kitState,
  kitQuantity,
  kitName,
}: KitPresentablePreviewProps) {
  const narrative = useMemo(() => buildNarrative(kitState, kitName), [kitState, kitName]);
  const grandTotal = kitState.totalPrice * kitQuantity;
  const validityDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString('pt-BR');
  }, []);

  if (!kitState.box && kitState.items.length === 0) return null;

  return (
    <Card className="overflow-hidden border-[1.5px] border-primary/20">
      <div className="border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-primary">
              Apresentação para o cliente
            </span>
          </div>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Calendar className="h-3 w-3" /> Válido até {validityDate}
          </Badge>
        </div>
        <h3 className="font-display text-2xl font-bold leading-tight">
          {kitName?.trim() || 'Kit Personalizado'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{narrative}</p>
      </div>

      <CardContent className="space-y-5 p-6">
        {/* Items grid */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4 text-muted-foreground" />
            Composição
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {kitState.box && (
              <div className="space-y-2 rounded-lg border bg-card p-2">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted/40">
                  {kitState.box.imageUrl ? (
                    <img
                      src={kitState.box.imageUrl}
                      alt={kitState.box.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Package className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Badge variant="secondary" className="mb-1 text-[9px]">
                    Embalagem
                  </Badge>
                  <p className="line-clamp-2 text-xs font-medium leading-tight">
                    {kitState.box.name}
                  </p>
                </div>
              </div>
            )}
            {kitState.items.map((item) => (
              <div key={item.id} className="space-y-2 rounded-lg border bg-card p-2">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted/40">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Package className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  {item.quantity > 1 && (
                    <Badge variant="outline" className="mb-1 text-[9px]">
                      {item.quantity}x
                    </Badge>
                  )}
                  <p className="line-clamp-2 text-xs font-medium leading-tight">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Pricing block */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantidade</p>
            <p className="font-display text-lg font-bold">
              {kitQuantity}
              <span className="text-xs font-normal text-muted-foreground"> kits</span>
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Por kit</p>
            <p className="font-display text-lg font-bold">{formatCurrency(kitState.totalPrice)}</p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-primary">Investimento</p>
            <p className="font-display text-lg font-bold text-primary">
              {formatCurrency(grandTotal)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

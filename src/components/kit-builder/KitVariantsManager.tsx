/**
 * KitVariantsManager — gerencia variantes (P/M/G) de um Kit Master.
 * Comparativo lado-a-lado de preço e contagem de itens.
 */
import { useState } from 'react';
import { Layers, Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useKitVariants } from '@/hooks/kit-builder';
import { formatCurrency, type KitState } from '@/lib/kit-builder';

interface Props {
  kitMasterId: string | undefined;
  currentState: KitState;
  currentQuantity: number;
}

export function KitVariantsManager({ kitMasterId, currentState, currentQuantity }: Props) {
  const { variants, isLoading, createVariant, removeVariant, isCreating } = useKitVariants(kitMasterId);
  const [label, setLabel] = useState('');

  if (!kitMasterId) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Salve o kit primeiro para criar variantes (P/M/G, Premium, etc.).
        </CardContent>
      </Card>
    );
  }

  const handleCreate = async () => {
    if (!label.trim()) return;
    await createVariant({ label: label.trim(), kitState: currentState, kitQuantity: currentQuantity });
    setLabel('');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Variantes do Kit
          <Badge variant="secondary" className="ml-auto">{variants.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome da variante (P, M, G, Premium...)"
            className="h-9"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <Button size="sm" onClick={handleCreate} disabled={isCreating || !label.trim()}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}

        {variants.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {variants.map((v) => {
              const itemsCount = Array.isArray(v.items_data) ? v.items_data.length : 0;
              return (
                <div
                  key={v.id}
                  className="border rounded-lg p-3 space-y-1 bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm">{v.label}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => removeVariant(v.id)}
                      aria-label={`Remover variante ${v.label}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{itemsCount} {itemsCount === 1 ? 'item' : 'itens'} · qtd {v.kit_quantity}</p>
                  <p className="text-sm font-semibold text-primary">{formatCurrency(Number(v.total_price))}</p>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && variants.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhuma variante. Crie versões (P/M/G) para apresentar ao cliente lado a lado.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

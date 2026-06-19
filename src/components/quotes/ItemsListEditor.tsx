/**
 * ItemsListEditor — editor de linha de itens de orçamento (qtd, preço unitário, observações).
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Button } from '@/components/ui/button';
import { Trash2, Package } from 'lucide-react';

export interface QuoteItemRow {
  id?: string;
  product_name: string;
  product_sku?: string | null;
  quantity: number;
  unit_price: number;
  notes?: string | null;
}

interface ItemsListEditorProps {
  items: QuoteItemRow[];
  onChange: (next: QuoteItemRow[]) => void;
}

export function ItemsListEditor({ items, onChange }: ItemsListEditorProps) {
  const update = (idx: number, patch: Partial<QuoteItemRow>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4 text-primary" /> Itens ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.id ?? idx}
              className="grid grid-cols-12 items-end gap-2 border-b pb-2 last:border-0"
            >
              <div className="col-span-12 sm:col-span-5">
                <Input
                  placeholder="Produto"
                  value={item.product_name}
                  onChange={(e) => update(idx, { product_name: e.target.value })}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="Qtd"
                  value={item.quantity}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === '+' || e.key === 'e') e.preventDefault();
                  }}
                  onChange={(e) =>
                    update(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <CurrencyInput
                  placeholder="Preço unit."
                  value={item.unit_price}
                  onChange={(n) => update(idx, { unit_price: n })}
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(idx)}
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

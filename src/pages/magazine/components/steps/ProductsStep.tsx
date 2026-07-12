/**
 * Step 2 — Produtos: busca no catálogo + multi-select + variantes.
 */

import { useMemo, useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts } from '@/hooks/products/useProducts';
import type { Product } from '@/types/product-catalog';
import type { Magazine, MagazineItem } from '@/types/magazine';

interface Props {
  magazine: Magazine;
  onAdd: (products: Product[]) => void;
  onRemove: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<MagazineItem>) => void;
}

export function ProductsStep({ magazine, onAdd, onRemove, onUpdateItem }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: products = [], isLoading } = useProducts({ search: query, limit: 60 });

  const alreadyAdded = useMemo(() => new Set(magazine.items.map((i) => i.productId)), [magazine.items]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const toAdd = products.filter((p) => selected.has(p.id));
    onAdd(toAdd);
    setSelected(new Set());
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produtos por nome, SKU ou descrição…"
              className="pl-9"
              data-testid="magazine-product-search"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isLoading ? 'Carregando…' : `${products.length} produto(s) encontrado(s)`}
            </span>
            <Button size="sm" onClick={handleAdd} disabled={selected.size === 0}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Adicionar {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </div>
          <ScrollArea className="h-[560px]">
            <div className="grid grid-cols-2 gap-3 pr-2 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => {
                const isIn = alreadyAdded.has(p.id);
                const isSel = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => !isIn && toggle(p.id)}
                    disabled={isIn}
                    className={`group flex flex-col overflow-hidden rounded-lg border text-left transition ${
                      isSel
                        ? 'border-primary ring-2 ring-primary/40'
                        : isIn
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:border-primary/60'
                    }`}
                  >
                    <div className="aspect-square overflow-hidden bg-muted/40">
                      {p.primary_image_url || p.image_url ? (
                        <img
                          src={p.primary_image_url || p.image_url}
                          alt={p.name}
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="p-2">
                      <div className="line-clamp-2 text-xs font-medium">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">Cód. {p.sku}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="text-sm font-semibold">
            Produtos selecionados ({magazine.items.length})
          </div>
          <ScrollArea className="h-[600px]">
            <div className="space-y-2 pr-2">
              {magazine.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border p-2">
                  <img
                    src={item.productSnapshot.image_url}
                    alt=""
                    className="h-14 w-14 rounded object-cover"
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="line-clamp-1 text-sm font-medium">{item.productSnapshot.name}</div>
                    <div className="text-xs text-muted-foreground">Cód. {item.productSnapshot.sku}</div>
                    {item.productSnapshot.colors.length > 0 && (
                      <select
                        value={item.variantColorName ?? ''}
                        onChange={(e) =>
                          onUpdateItem(item.id, { variantColorName: e.target.value || null })
                        }
                        className="mt-1 w-full rounded border bg-background px-1 py-0.5 text-xs"
                        aria-label="Cor selecionada"
                      >
                        <option value="">Imagem principal</option>
                        {item.productSnapshot.colors.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    aria-label="Remover produto"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {magazine.items.length === 0 && (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  Selecione produtos ao lado e clique em Adicionar.
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

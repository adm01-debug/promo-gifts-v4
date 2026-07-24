/**
 * Step 2 — Produtos: busca + filtros (categoria, personalização) + multi-select
 * com contador ao vivo de páginas geradas. Item selecionado usa VariantColorSelect.
 */

import { useMemo, useState } from 'react';
import { Search, Plus, X, Sparkles, Filter, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useProducts } from '@/hooks/products/useProducts';
import type { Product } from '@/types/product-catalog';
import type { Magazine, MagazineItem } from '@/types/magazine';
import { getTemplate } from '../templates/TemplateRegistry';
import { VariantColorSelect } from '../VariantColorSelect';

interface Props {
  magazine: Magazine;
  onAdd: (products: Product[]) => void;
  onRemove: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<MagazineItem>) => void;
}

export function ProductsStep({ magazine, onAdd, onRemove, onUpdateItem }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<string | null>(null);
  const [onlyPersonalizable, setOnlyPersonalizable] = useState(false);
  const [hideAdded, setHideAdded] = useState(true);

  const { data: products = [], isLoading } = useProducts({ search: query, limit: 80 });

  const alreadyAdded = useMemo(
    () => new Set(magazine.items.map((i) => i.productId)),
    [magazine.items],
  );

  const categoryOptions = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of products) {
      const c = p.category_name ?? null;
      if (!c) continue;
      set.set(c, (set.get(c) ?? 0) + 1);
    }
    return [...set.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (hideAdded && alreadyAdded.has(p.id)) return false;
      if (category && p.category_name !== category) return false;
      if (onlyPersonalizable && !p.hasPersonalization) return false;
      return true;
    });
  }, [products, hideAdded, alreadyAdded, category, onlyPersonalizable]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const toAdd = filtered.filter((p) => selected.has(p.id));
    onAdd(toAdd);
    setSelected(new Set());
  };

  const clearFilters = () => {
    setCategory(null);
    setOnlyPersonalizable(false);
    setQuery('');
  };

  const template = getTemplate(magazine.templateId);
  const perPage = template.productsPerPage;
  const totalItems = magazine.items.length;
  const estimatedPages = Math.max(0, Math.ceil(totalItems / perPage));
  const previewItems = totalItems + selected.size;
  const previewPages = Math.max(0, Math.ceil(previewItems / perPage));

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
              aria-label="Buscar produtos"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
            <span className="flex items-center gap-1 pr-1 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" aria-hidden /> Filtros
            </span>
            {categoryOptions.slice(0, 8).map(([cat, count]) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(active ? null : cat)}
                  className={`rounded-full border px-2 py-0.5 text-xs transition ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background hover:border-primary/60'
                  }`}
                  aria-pressed={active}
                >
                  {cat} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setOnlyPersonalizable(!onlyPersonalizable)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                onlyPersonalizable
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:border-primary/60'
              }`}
              aria-pressed={onlyPersonalizable}
            >
              <Sparkles className="h-3 w-3" aria-hidden /> Personalizáveis
            </button>
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
              Ocultar adicionados
              <Switch
                checked={hideAdded}
                onCheckedChange={setHideAdded}
                aria-label="Ocultar produtos já adicionados"
              />
            </label>
            {(category || onlyPersonalizable || query) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                Limpar
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isLoading
                ? 'Carregando…'
                : `${filtered.length} produto${filtered.length === 1 ? '' : 's'} · ${selected.size} selecionado${selected.size === 1 ? '' : 's'}`}
            </span>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={selected.size === 0}
              data-testid="magazine-product-add-btn"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Adicionar {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </div>

          <ScrollArea className="h-[560px]">
            <div className="grid grid-cols-2 gap-3 pr-2 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((p) => {
                const isIn = alreadyAdded.has(p.id);
                const isSel = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => !isIn && toggle(p.id)}
                    disabled={isIn}
                    aria-pressed={isSel}
                    className={`group relative flex flex-col overflow-hidden rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
                      {p.hasPersonalization && (
                        <Badge
                          variant="secondary"
                          className="absolute left-2 top-2 h-5 px-1.5 text-[10px]"
                        >
                          <Sparkles className="mr-0.5 h-2.5 w-2.5" /> Personalizável
                        </Badge>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="line-clamp-2 text-xs font-medium">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">Cód. {p.sku}</div>
                    </div>
                  </button>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <div className="col-span-full rounded-md border border-dashed p-8 text-center text-xs text-muted-foreground">
                  Nenhum produto corresponde aos filtros.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              Selecionados ({magazine.items.length})
            </div>
            <div
              className="rounded-md border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
              aria-live="polite"
            >
              {estimatedPages} pág. · template {perPage}/pág
              {selected.size > 0 && (
                <span className="ml-1 text-primary">→ {previewPages} com +{selected.size}</span>
              )}
            </div>
          </div>
          <ScrollArea className="h-[600px]">
            <div className="space-y-2 pr-2">
              {magazine.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border p-2">
                  <img
                    src={item.productSnapshot.image_url}
                    alt={item.productSnapshot.name}
                    className="h-14 w-14 rounded object-cover"
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="line-clamp-1 text-sm font-medium">{item.productSnapshot.name}</div>
                    <div className="text-xs text-muted-foreground">Cód. {item.productSnapshot.sku}</div>
                    <VariantColorSelect
                      item={item}
                      onChange={(colorName) => onUpdateItem(item.id, { variantColorName: colorName })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remover ${item.productSnapshot.name}`}
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
